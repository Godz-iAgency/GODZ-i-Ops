from __future__ import annotations

import unittest
from datetime import datetime, timezone

from tools.bookworm_tiktok.cli import budget_plan
from tools.bookworm_tiktok.models import Creator, Video
from tools.bookworm_tiktok.parser import merge_creator_maps, parse_items
from tools.bookworm_tiktok.pipeline import classify, prioritize_for_enrichment, rank


class ParserTests(unittest.TestCase):
    def test_actor_shape_is_parsed_and_deduplicated(self) -> None:
        items = [
            {
                "id": "v1",
                "createTimeISO": "2026-09-23T12:00:00.000Z",
                "playCount": 1000,
                "diggCount": 60,
                "commentCount": 5,
                "shareCount": 5,
                "authorMeta": {"id": "u1", "name": "reader", "nickName": "Reader", "fans": 20000},
            },
            {
                "id": "v2",
                "createTimeISO": "2026-09-22T12:00:00.000Z",
                "playCount": 2000,
                "diggCount": 100,
                "commentCount": 10,
                "shareCount": 10,
                "authorMeta": {"id": "u1", "name": "reader", "fans": 20000},
            },
        ]
        creators, errors = parse_items(items, "hashtag:booktok")
        self.assertEqual(errors, 0)
        self.assertEqual(len(creators), 1)
        self.assertEqual(len(creators["u1"].videos), 2)
        self.assertEqual(creators["u1"].discovery_category, "hashtag:booktok")

    def test_username_merges_when_discovery_lacks_user_id(self) -> None:
        discovery, _ = parse_items([{"authorMeta": {"name": "reader"}}], "search:books")
        enriched, _ = parse_items([{"id": "v1", "playCount": 100, "authorMeta": {"id": "u1", "name": "reader"}}], "profile-batch:1")
        merge_creator_maps(discovery, enriched)
        self.assertEqual(len(discovery), 1)
        creator = next(iter(discovery.values()))
        self.assertEqual(creator.discovery_sources, ["search:books"])


class MetricTests(unittest.TestCase):
    def test_metrics_and_filters(self) -> None:
        creator = Creator(
            key="u1",
            username="reader",
            follower_count=20_000,
            videos=[
                Video("v1", 10_000, 500, 100, 100, "2026-09-23T12:00:00Z"),
                Video("v2", 20_000, 1_000, 100, 100, "2026-09-22T12:00:00Z"),
                Video("v3", 0, 10, 10, 10, "2026-09-21T12:00:00Z"),
            ],
        )
        creator.calculate_metrics(datetime(2026, 9, 24, tzinfo=timezone.utc))
        self.assertEqual(creator.average_views_per_video, 15_000)
        self.assertAlmostEqual(creator.average_engagement_rate_percent or 0, 6.5)
        self.assertEqual(creator.follower_to_average_views_ratio, 0.75)
        self.assertEqual(creator.days_since_last_post, 0)
        config = {"filters": {"minimum_followers": 10_000, "maximum_followers": 300_000, "minimum_engagement_rate_percent": 3, "maximum_days_since_last_post": 14}}
        primary, reserve, discarded = classify([creator], config)
        self.assertEqual(len(primary), 1)
        self.assertFalse(reserve)
        self.assertFalse(discarded)

    def test_only_follower_failure_goes_to_reserve(self) -> None:
        creator = Creator(key="u2", username="large", follower_count=500_000, average_engagement_rate_percent=5, days_since_last_post=2)
        config = {"filters": {"minimum_followers": 10_000, "maximum_followers": 300_000, "minimum_engagement_rate_percent": 3, "maximum_days_since_last_post": 14}}
        primary, reserve, discarded = classify([creator], config)
        self.assertFalse(primary)
        self.assertEqual(len(reserve), 1)
        self.assertFalse(discarded)

    def test_ranking_is_engagement_descending(self) -> None:
        low = Creator(key="1", username="low", average_engagement_rate_percent=3)
        high = Creator(key="2", username="high", average_engagement_rate_percent=8)
        self.assertEqual([item.username for item in rank([low, high], "engagement_rate_desc")], ["high", "low"])

    def test_paid_enrichment_prioritizes_likely_primary_creator(self) -> None:
        now = datetime(2026, 9, 24, tzinfo=timezone.utc)
        stale = Creator(
            key="stale",
            username="stale",
            follower_count=20_000,
            videos=[Video("s", 1000, 200, 0, 0, "2026-08-01T12:00:00Z")],
        )
        likely_primary = Creator(
            key="primary",
            username="primary",
            follower_count=20_000,
            videos=[Video("p", 1000, 50, 0, 0, "2026-09-23T12:00:00Z")],
        )
        config = {"filters": {"minimum_followers": 10_000, "maximum_followers": 300_000, "minimum_engagement_rate_percent": 3, "maximum_days_since_last_post": 14}}
        ordered = prioritize_for_enrichment([stale, likely_primary], config, now, 10)
        self.assertEqual(ordered[0].username, "primary")


class BudgetTests(unittest.TestCase):
    def test_five_dollar_plan_keeps_a_safety_reserve(self) -> None:
        config = {
            "hashtags": [str(index) for index in range(8)],
            "search_queries": [str(index) for index in range(4)],
            "recent_videos_per_profile": 10,
            "profile_batch_size": 50,
            "budget": {
                "maximum_usd": 5,
                "safety_reserve_usd": 0.1,
                "result_price_per_1000_usd": 3.7,
                "actor_start_price_usd": 0.001,
            },
        }
        plan = budget_plan(config, 20)
        self.assertEqual(plan["max_creators"], 108)
        self.assertLessEqual(plan["estimated_cost_usd"], 4.9)


if __name__ == "__main__":
    unittest.main()
