from __future__ import annotations

import unittest
from datetime import datetime, timezone

from tools.bookworm_tiktok.models import Creator, Video
from tools.bookworm_tiktok.parser import merge_creator_maps, parse_items
from tools.bookworm_tiktok.pipeline import classify, rank


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

    def test_username_merges_when_discovery_lacks_user_id(self) -> None:
        discovery, _ = parse_items([{"authorMeta": {"name": "reader"}}], "search:books")
        enriched, _ = parse_items([{"id": "v1", "playCount": 100, "authorMeta": {"id": "u1", "name": "reader"}}])
        merge_creator_maps(discovery, enriched)
        self.assertEqual(len(discovery), 1)


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


if __name__ == "__main__":
    unittest.main()

