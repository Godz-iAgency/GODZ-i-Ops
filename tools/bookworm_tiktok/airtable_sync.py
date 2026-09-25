from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Iterable

from .models import Creator


class AirtableSync:
    def __init__(self, token: str, base_id: str, table_id: str) -> None:
        self.token = token
        self.base_id = base_id
        self.table_id = table_id
        self.base_url = f"https://api.airtable.com/v0/{base_id}/{table_id}"
        self.log = logging.getLogger("bookworm_tiktok.airtable")

    def _request(self, method: str, url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(url, data=body, method=method, headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code != 429 and error.code < 500:
                    raise
                if attempt == 4:
                    raise
                retry_after = error.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else min(8.0, 0.5 * (2**attempt))
                self.log.warning("Airtable request throttled or unavailable; retrying in %.1fs", delay)
                time.sleep(delay)
        raise RuntimeError("Airtable request failed after retries")

    def existing(self) -> dict[str, str]:
        result: dict[str, str] = {}
        offset: str | None = None
        while True:
            query = {"pageSize": "100"}
            if offset:
                query["offset"] = offset
            page = self._request("GET", f"{self.base_url}?{urllib.parse.urlencode(query)}")
            for record in page.get("records", []):
                fields = record.get("fields", {})
                for value in (fields.get("TikTok User ID"), fields.get("TikTok Handle")):
                    if value:
                        result[str(value).strip().lstrip("@").lower()] = record["id"]
            offset = page.get("offset")
            if not offset:
                return result

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
        index = self.existing()
        creates: list[dict[str, Any]] = []
        updates: list[dict[str, Any]] = []
        for creator in creators:
            key_candidates = [candidate for candidate in (creator.user_id, creator.username) if candidate]
            record_id = next((index.get(str(candidate).strip().lstrip("@").lower()) for candidate in key_candidates if index.get(str(candidate).strip().lstrip("@").lower())), None)
            fields = self.fields(creator)
            if record_id:
                updates.append({"id": record_id, "fields": fields})
            else:
                creates.append({"fields": {**fields, "Status": "New"}})

        for records, method in ((creates, "POST"), (updates, "PATCH")):
            for start in range(0, len(records), 10):
                self._request(method, f"{self.base_url}?typecast=true", {"records": records[start : start + 10]})
                time.sleep(0.22)
        summary = {"created": len(creates), "updated": len(updates)}
        self.log.info("Airtable sync complete: %s", summary)
        return summary
