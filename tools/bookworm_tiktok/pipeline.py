from __future__ import annotations

import csv
import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .apify_client import ApifyClient, ApifyError
from .models import Creator
from .parser import merge_creator_maps, parse_items


CSV_COLUMNS = [
    "Username",
    "Display Name",
    "Follower Count",
    "Average Views Per Video",
    "Average Engagement Rate %",
    "Follower To Avg Views Ratio",
    "Days Since Last Post",
    "Bio",
    "Profile URL",
    "Discovery Source",
]


@dataclass(slots=True)
class PipelineStats:
    total_creators_discovered: int = 0
    unique_creators_discovered: int = 0
    profiles_enriched: int = 0
    primary_creators: int = 0
    reserve_creators: int = 0
    creators_discarded: int = 0
    actor_error_items: int = 0


class JsonCache:
    def __init__(self, directory: Path, refresh: bool = False) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh

    def key(self, name: str, payload: dict[str, Any]) -> Path:
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]
        return self.directory / f"{name}-{digest}.json"

    def get(self, name: str, payload: dict[str, Any]) -> list[dict[str, Any]] | None:
        path = self.key(name, payload)
        if self.refresh or not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def put(self, name: str, payload: dict[str, Any], items: list[dict[str, Any]]) -> Path:
        path = self.key(name, payload)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        return path


def _batched(values: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def classify(creators: Iterable[Creator], config: dict[str, Any]) -> tuple[list[Creator], list[Creator], list[Creator]]:
    filters = config["filters"]
    primary: list[Creator] = []
    reserve: list[Creator] = []
    discarded: list[Creator] = []
    for creator in creators:
        engagement = creator.average_engagement_rate_percent
        days = creator.days_since_last_post
        if engagement is None or engagement < float(filters["minimum_engagement_rate_percent"]):
            creator.discard_reason = "engagement below threshold or unavailable"
            discarded.append(creator)
            continue
        if days is None or days > int(filters["maximum_days_since_last_post"]):
            creator.discard_reason = "recent activity below threshold or unavailable"
            discarded.append(creator)
            continue
        followers = creator.follower_count
        if followers is not None and int(filters["minimum_followers"]) <= followers <= int(filters["maximum_followers"]):
            creator.list_name = "Primary"
            primary.append(creator)
        else:
            creator.list_name = "Reserve"
            reserve.append(creator)
    return primary, reserve, discarded


def rank(creators: list[Creator], strategy: str) -> list[Creator]:
    if strategy == "engagement_rate_desc":
        return sorted(creators, key=lambda item: item.average_engagement_rate_percent or -1, reverse=True)
    raise ValueError(f"Unknown ranking strategy: {strategy}")


def _csv_row(creator: Creator) -> dict[str, Any]:
    return {
        "Username": creator.username,
        "Display Name": creator.display_name or "",
        "Follower Count": creator.follower_count if creator.follower_count is not None else "",
        "Average Views Per Video": round(creator.average_views_per_video, 2) if creator.average_views_per_video is not None else "",
        "Average Engagement Rate %": round(creator.average_engagement_rate_percent, 3) if creator.average_engagement_rate_percent is not None else "",
        "Follower To Avg Views Ratio": round(creator.follower_to_average_views_ratio, 4) if creator.follower_to_average_views_ratio is not None else "",
        "Days Since Last Post": creator.days_since_last_post if creator.days_since_last_post is not None else "",
        "Bio": creator.bio or "",
        "Profile URL": creator.profile_url or f"https://www.tiktok.com/@{creator.username}",
        "Discovery Source": "; ".join(creator.discovery_sources),
    }


def write_outputs(output_dir: Path, primary: list[Creator], reserve: list[Creator], discarded: list[Creator], stats: PipelineStats) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, creators in (("primary_creators.csv", primary), ("reserve_creators.csv", reserve)):
        with (output_dir / name).open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(_csv_row(creator) for creator in creators)
    normalized = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "formula": {"follower_to_average_views_ratio": "average_views_per_video / follower_count"},
        "stats": asdict(stats),
        "primary": [creator.normalized() for creator in primary],
        "reserve": [creator.normalized() for creator in reserve],
        "discarded": [creator.normalized() for creator in discarded],
    }
    (output_dir / "creators.normalized.json").write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "run-summary.json").write_text(json.dumps(asdict(stats), indent=2), encoding="utf-8")


def print_table(creators: list[Creator], limit: int = 25) -> None:
    rows = [("Username", "Followers", "Avg views", "Engagement", "Days", "List")]
    for creator in creators[:limit]:
        rows.append((
            f"@{creator.username}",
            str(creator.follower_count or "—"),
            f"{creator.average_views_per_video:.0f}" if creator.average_views_per_video is not None else "—",
            f"{creator.average_engagement_rate_percent:.2f}%" if creator.average_engagement_rate_percent is not None else "—",
            str(creator.days_since_last_post if creator.days_since_last_post is not None else "—"),
            creator.list_name or "—",
        ))
    widths = [max(len(row[column]) for row in rows) for column in range(len(rows[0]))]
    for index, row in enumerate(rows):
        print("  ".join(value.ljust(widths[column]) for column, value in enumerate(row)))
        if index == 0:
            print("  ".join("-" * width for width in widths))


class Pipeline:
    def __init__(self, config: dict[str, Any], client: ApifyClient, cache: JsonCache, max_creators: int | None = None) -> None:
        self.config = config
        self.client = client
        self.cache = cache
        self.max_creators = max_creators
        self.log = logging.getLogger("bookworm_tiktok.pipeline")

    def _run_cached(self, name: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
        cached = self.cache.get(name, payload)
        if cached is not None:
            self.log.info("Using cached %s results (%d items)", name, len(cached))
            return cached
        run_id, items = self.client.run_actor(payload)
        path = self.cache.put(name, payload, items)
        self.log.info("Saved Actor run %s to %s", run_id, path)
        return items

    def run(self, results_per_source: int | None = None) -> tuple[list[Creator], list[Creator], list[Creator], PipelineStats]:
        per_source = results_per_source or int(self.config["results_per_source"])
        common = {
            "resultsPerPage": per_source,
            "shouldDownloadVideos": False,
            "shouldDownloadCovers": False,
            "shouldDownloadAvatars": False,
            "shouldDownloadMusicCovers": False,
            "shouldDownloadSlideshowImages": False,
        }
        discovery_runs = [
            ("discovery-hashtags", {**common, "hashtags": self.config["hashtags"]}),
            ("discovery-search", {**common, "searchQueries": self.config["search_queries"]}),
        ]
        creators: dict[str, Creator] = {}
        stats = PipelineStats()
        for name, payload in discovery_runs:
            items = self._run_cached(name, payload)
            stats.total_creators_discovered += len(items)
            parsed, errors = parse_items(items, name)
            stats.actor_error_items += errors
            merge_creator_maps(creators, parsed)

        stats.unique_creators_discovered = len(creators)
        usernames = [creator.username for creator in creators.values() if creator.username]
        if self.max_creators:
            usernames = usernames[: self.max_creators]
            allowed = {username.lower() for username in usernames}
            creators = {key: creator for key, creator in creators.items() if creator.username.lower() in allowed}

        enriched_keys: set[str] = set()
        batch_size = int(self.config.get("profile_batch_size", 50))
        video_limit = int(self.config.get("recent_videos_per_profile", 15))
        for index, batch in enumerate(_batched(usernames, batch_size), start=1):
            payload = {
                "profiles": batch,
                "resultsPerPage": video_limit,
                "profileScrapeSections": ["videos"],
                "profileSorting": "latest",
                "excludePinnedPosts": True,
                "shouldDownloadVideos": False,
                "shouldDownloadCovers": False,
                "shouldDownloadAvatars": False,
            }
            try:
                items = self._run_cached(f"profiles-{index}", payload)
            except ApifyError as error:
                self.log.error("Profile batch %d failed; keeping partial results: %s", index, error)
                continue
            parsed, errors = parse_items(items, f"profile-batch:{index}")
            stats.actor_error_items += errors
            merge_creator_maps(creators, parsed)
            enriched_keys.update(parsed.keys())

        now = datetime.now(timezone.utc)
        for creator in creators.values():
            creator.calculate_metrics(now, video_limit)
        stats.profiles_enriched = sum(1 for creator in creators.values() if creator.videos)

        primary, reserve, discarded = classify(creators.values(), self.config)
        strategy = self.config.get("ranking", {}).get("strategy", "engagement_rate_desc")
        primary = rank(primary, strategy)
        reserve = rank(reserve, strategy)
        stats.primary_creators = len(primary)
        stats.reserve_creators = len(reserve)
        stats.creators_discarded = len(discarded)
        return primary, reserve, discarded, stats
