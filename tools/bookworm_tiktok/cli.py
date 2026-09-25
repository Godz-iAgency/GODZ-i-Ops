from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from pathlib import Path
from typing import Any

from .airtable_sync import AirtableSync
from .apify_client import ApifyClient, ApifyError
from .pipeline import JsonCache, Pipeline, print_table, write_outputs


ROOT = Path(__file__).resolve().parents[2]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    required = ["actor_id", "hashtags", "search_queries", "filters"]
    missing = [key for key in required if key not in config]
    if missing:
        raise ValueError(f"Missing config keys: {', '.join(missing)}")
    return config


def budget_plan(
    config: dict[str, Any],
    results_per_source: int,
    requested_max_creators: int | None = None,
    budget_usd: float | None = None,
) -> dict[str, int | float]:
    if results_per_source <= 0:
        raise ValueError("Results per source must be greater than zero.")
    if requested_max_creators is not None and requested_max_creators < 0:
        raise ValueError("Maximum creators cannot be negative.")
    budget = config.get("budget", {})
    maximum = float(budget_usd if budget_usd is not None else budget.get("maximum_usd", 5.0))
    reserve = float(budget.get("safety_reserve_usd", 0.1))
    if maximum <= 0 or reserve < 0 or reserve >= maximum:
        raise ValueError("Budget must be positive and larger than its safety reserve.")
    usable = maximum - reserve
    result_price = float(budget.get("result_price_per_1000_usd", 3.7))
    start_price = float(budget.get("actor_start_price_usd", 0.001))
    source_count = len(config.get("hashtags", [])) + len(config.get("search_queries", []))
    discovery_runs = int(bool(config.get("hashtags"))) + int(bool(config.get("search_queries")))
    discovery_results = source_count * results_per_source
    video_limit = int(config.get("recent_videos_per_profile", 10))
    batch_size = int(config.get("profile_batch_size", 50))

    def estimate(profile_count: int) -> tuple[int, int, float]:
        actor_runs = discovery_runs + (math.ceil(profile_count / batch_size) if profile_count else 0)
        returned_results = discovery_results + profile_count * video_limit
        cost = returned_results * result_price / 1000 + actor_runs * start_price
        return returned_results, actor_runs, cost

    if estimate(0)[2] > usable:
        raise ValueError(
            f"Discovery alone could cost ${estimate(0)[2]:.2f}, above the usable ${usable:.2f} budget. "
            "Lower --results-per-source."
        )

    safe_max = 0
    for profile_count in range(discovery_results + 1):
        if estimate(profile_count)[2] <= usable:
            safe_max = profile_count
        else:
            break
    selected_max = safe_max if requested_max_creators is None else min(requested_max_creators, safe_max)
    returned_results, actor_runs, estimated_cost = estimate(selected_max)
    return {
        "budget_usd": maximum,
        "safety_reserve_usd": reserve,
        "discovery_results": discovery_results,
        "max_creators": selected_max,
        "max_returned_results": returned_results,
        "max_actor_runs": actor_runs,
        "estimated_cost_usd": estimated_cost,
    }


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Discover and qualify Bookworm TikTok creators with Apify.")
    command.add_argument("--config", type=Path, default=ROOT / "config" / "bookworm_tiktok.json")
    command.add_argument("--output-dir", type=Path, default=ROOT / "data" / "bookworm-tiktok")
    command.add_argument("--cache-dir", type=Path, default=ROOT / ".cache" / "bookworm-tiktok")
    command.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    command.add_argument("--refresh", action="store_true", help="Ignore compatible cached Actor results.")
    command.add_argument("--sync-airtable", action="store_true", help="Upsert primary and reserve creators into Airtable.")
    command.add_argument("--results-per-source", type=int, help="Override discovery results per query/hashtag.")
    command.add_argument("--max-creators", type=int, help="Limit enrichment for a smoke test or partial run.")
    command.add_argument("--budget-usd", type=float, help="Hard maximum Apify spend estimate (default: config budget).")
    command.add_argument("--dry-run", action="store_true", help="Validate configuration and confirm required credentials are present without starting Actor runs.")
    command.add_argument("--verbose", action="store_true")
    return command


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    load_env(args.env_file)
    config = load_config(args.config)
    per_source = args.results_per_source or int(config["results_per_source"])
    try:
        plan = budget_plan(config, per_source, args.max_creators, args.budget_usd)
    except ValueError as error:
        print(f"Budget plan invalid: {error}", file=sys.stderr)
        return 2
    max_creators = int(plan["max_creators"])
    args.output_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(args.output_dir / "pipeline.log", encoding="utf-8")],
    )

    token = os.getenv("APIFY_API_TOKEN") or os.getenv("APIFY_API_KEY")
    if not token:
        print("Missing APIFY_API_TOKEN (APIFY_API_KEY is accepted as a legacy alias).", file=sys.stderr)
        return 2
    if args.dry_run:
        print(f"Configuration valid: {len(config['hashtags'])} hashtags, {len(config['search_queries'])} queries")
        print(
            f"Budget guard: enrich up to {max_creators} creators, return up to "
            f"{plan['max_returned_results']} results, estimated maximum ${plan['estimated_cost_usd']:.3f} "
            f"of ${plan['budget_usd']:.2f}."
        )
        print("Required credential variables are present. No Actor run started.")
        return 0

    print(
        f"Apify budget guard: up to {max_creators} creators and {plan['max_returned_results']} returned results; "
        f"estimated maximum ${plan['estimated_cost_usd']:.3f} of ${plan['budget_usd']:.2f}."
    )

    request = config.get("request", {})
    client = ApifyClient(
        token,
        config["actor_id"],
        timeout_seconds=int(request.get("timeout_seconds", 900)),
        poll_interval_seconds=int(request.get("poll_interval_seconds", 5)),
        max_retries=int(request.get("max_retries", 4)),
    )
    pipeline = Pipeline(config, client, JsonCache(args.cache_dir, args.refresh), max_creators)
    try:
        primary, reserve, discarded, stats = pipeline.run(per_source)
    except ApifyError as error:
        message = str(error)
        if "HTTP 401" in message:
            print(
                "Apify rejected the configured token. Replace APIFY_API_TOKEN "
                "(or the legacy APIFY_API_KEY value) with a valid Apify API token.",
                file=sys.stderr,
            )
        else:
            print(f"Apify pipeline failed: {message}", file=sys.stderr)
        return 1
    write_outputs(args.output_dir, primary, reserve, discarded, stats)
    print_table(primary + reserve)
    print()
    print(f"Total creators discovered: {stats.total_creators_discovered}")
    print(f"Unique creators discovered: {stats.unique_creators_discovered}")
    print(f"Profiles enriched: {stats.profiles_enriched}")
    print(f"Primary creators passing filter: {stats.primary_creators}")
    print(f"Reserve creators: {stats.reserve_creators}")
    print(f"Creators discarded: {stats.creators_discarded}")

    if args.sync_airtable:
        airtable_token = os.getenv("AIRTABLE_PAT")
        base_id = os.getenv("AIRTABLE_BASE_MUSIC")
        if not airtable_token or not base_id:
            print("AIRTABLE_PAT and AIRTABLE_BASE_MUSIC are required for --sync-airtable.", file=sys.stderr)
            return 2
        summary = AirtableSync(airtable_token, base_id, "tblKOYrjzZS8xdl60").sync([*primary, *reserve])
        print(f"Airtable sync: {summary['created']} created, {summary['updated']} updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
