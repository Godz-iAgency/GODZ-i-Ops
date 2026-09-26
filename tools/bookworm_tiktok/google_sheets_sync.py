from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Iterable

from .models import Creator


class GoogleSheetsSync:
    def __init__(self, app_url: str, secret: str) -> None:
        self.url = f"{app_url.rstrip('/')}/api/imports/bookworm-tiktok"
        self.secret = secret
        self.log = logging.getLogger("bookworm_tiktok.google_sheets")

    def _request(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.secret}",
                "Content-Type": "application/json",
            },
        )
        for attempt in range(5):
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                    detail = error.read().decode("utf-8", errors="replace")
                    raise RuntimeError(f"Google Sheets import failed with HTTP {error.code}: {detail}") from error
                retry_after = error.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else min(8.0, 0.5 * (2**attempt))
                self.log.warning("Google Sheets import unavailable; retrying in %.1fs", delay)
                time.sleep(delay)
            except urllib.error.URLError as error:
                if attempt == 4:
                    raise RuntimeError(f"Google Sheets import failed: {error.reason}") from error
                delay = min(8.0, 0.5 * (2**attempt))
                self.log.warning("Google Sheets import network error; retrying in %.1fs", delay)
                time.sleep(delay)
        raise RuntimeError("Google Sheets import failed after retries")

    @staticmethod
    def fields(creator: Creator) -> dict[str, Any]:
        values: dict[str, Any] = {
            "Name": creator.display_name or creator.username,
            "Display Name": creator.display_name or creator.username,
            "TikTok User ID": creator.user_id,
            "TikTok Handle": f"@{creator.username}",
            "TikTok URL": creator.profile_url or f"https://www.tiktok.com/@{creator.username}",
            "Followers": creator.follower_count,
            "Following": creator.following_count,
            "Total Likes": creator.total_likes,
            "Average Views": round(creator.average_views_per_video, 2) if creator.average_views_per_video is not None else None,
            "Average Engagement Rate %": round(creator.average_engagement_rate_percent, 3) if creator.average_engagement_rate_percent is not None else None,
            "Follower To Avg Views Ratio": round(creator.follower_to_average_views_ratio, 4) if creator.follower_to_average_views_ratio is not None else None,
            "Days Since Last Post": creator.days_since_last_post,
            "Last Post Date": creator.last_post_date,
            "Bio": creator.bio,
            "Discovery Source": "; ".join(creator.discovery_sources),
            "Discovery Category": creator.discovery_category,
            "List": creator.list_name,
            "Enriched At": datetime.now(timezone.utc).isoformat(),
        }
        return {key: value for key, value in values.items() if value not in (None, "")}

    def sync(self, creators: Iterable[Creator]) -> dict[str, int]:
        rows = [self.fields(creator) for creator in creators]
        summary = {"created": 0, "updated": 0, "skipped": 0}
        for start in range(0, len(rows), 200):
            result = self._request({"creators": rows[start : start + 200]})
            for key in summary:
                summary[key] += int(result.get(key, 0))
        self.log.info("Google Sheets sync complete: %s", summary)
        return summary
