from __future__ import annotations

import base64
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from .models import Creator


HEADERS = [
    "Record ID", "Name", "Display Name", "TikTok User ID", "TikTok Handle", "TikTok URL",
    "Followers", "Following", "Total Likes", "Average Views", "Average Engagement Rate %",
    "Follower To Avg Views Ratio", "Days Since Last Post", "Last Post Date", "Bio",
    "Discovery Source", "Discovery Category", "List", "Excluded", "Enriched At", "Niche",
    "Email", "Date Contacted", "Status", "Response", "Notes", "Next Action", "Next Action Date",
]


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _private_key(value: str) -> bytes:
    key = value.strip().strip('"').replace("\\n", "\n")
    if "BEGIN PRIVATE KEY" not in key:
        body = "".join(key.split())
        lines = [body[index : index + 64] for index in range(0, len(body), 64)]
        key = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(lines) + "\n-----END PRIVATE KEY-----\n"
    return key.encode("utf-8")


class GoogleSheetsSync:
    def __init__(self, spreadsheet_id: str, client_email: str, private_key: str, tab: str = "Bookworm TikTok") -> None:
        self.spreadsheet_id = spreadsheet_id
        self.client_email = client_email
        self.private_key = _private_key(private_key)
        self.tab = tab
        self.log = logging.getLogger("bookworm_tiktok.google_sheets")
        self._token: str | None = None
        self._token_expires_at = 0.0

    def _access_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 60:
            return self._token
        now = int(time.time())
        header = _base64url(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
        claims = _base64url(json.dumps({
            "iss": self.client_email,
            "scope": "https://www.googleapis.com/auth/spreadsheets",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        }, separators=(",", ":")).encode())
        unsigned = f"{header}.{claims}".encode("ascii")
        key = serialization.load_pem_private_key(self.private_key, password=None)
        signature = key.sign(unsigned, padding.PKCS1v15(), hashes.SHA256())
        assertion = f"{unsigned.decode('ascii')}.{_base64url(signature)}"
        body = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }).encode("utf-8")
        request = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=body,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        self._token = payload["access_token"]
        self._token_expires_at = time.time() + int(payload.get("expires_in", 3600))
        return self._token

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{self.spreadsheet_id}{path}"
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        for attempt in range(5):
            request = urllib.request.Request(
                url,
                data=body,
                method=method,
                headers={
                    "Authorization": f"Bearer {self._access_token()}",
                    **({"Content-Type": "application/json"} if body is not None else {}),
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    text = response.read().decode("utf-8")
                    return json.loads(text) if text else {}
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                    detail = error.read().decode("utf-8", errors="replace")
                    raise RuntimeError(f"Google Sheets sync failed with HTTP {error.code}: {detail}") from error
                delay = min(8.0, 0.5 * (2**attempt))
                self.log.warning("Google Sheets unavailable; retrying in %.1fs", delay)
                time.sleep(delay)
            except urllib.error.URLError as error:
                if attempt == 4:
                    raise RuntimeError(f"Google Sheets sync failed: {error.reason}") from error
                delay = min(8.0, 0.5 * (2**attempt))
                self.log.warning("Google Sheets network error; retrying in %.1fs", delay)
                time.sleep(delay)
        raise RuntimeError("Google Sheets sync failed after retries")

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

    @staticmethod
    def _key(fields: dict[str, Any]) -> str:
        return str(fields.get("TikTok User ID") or fields.get("TikTok Handle") or "").strip().lstrip("@").lower()

    def sync(self, creators: Iterable[Creator]) -> dict[str, int]:
        quoted_tab = urllib.parse.quote(f"'{self.tab}'!A:AB", safe="")
        data = self._request("GET", f"/values/{quoted_tab}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE")
        values = data.get("values", [])
        headers = [str(value) for value in (values[0] if values else HEADERS)]
        existing: dict[str, tuple[int, str, dict[str, Any]]] = {}
        for row_number, row in enumerate(values[1:], start=2):
            record = {header: row[index] for index, header in enumerate(headers) if index < len(row) and row[index] not in (None, "")}
            key = self._key(record)
            if key:
                existing[key] = (row_number, str(row[0]), record)

        creates: list[list[Any]] = []
        updates: list[dict[str, Any]] = []
        skipped = 0
        for creator in creators:
            fields = self.fields(creator)
            key = self._key(fields)
            if not key:
                skipped += 1
                continue
            current = existing.get(key)
            if current:
                row_number, record_id, old_fields = current
                merged = {**old_fields, **fields}
                updates.append({
                    "range": f"'{self.tab}'!A{row_number}:AB{row_number}",
                    "values": [[record_id if header == "Record ID" else merged.get(header, "") for header in HEADERS]],
                })
            else:
                record_id = f"gs_{uuid.uuid4()}"
                creates.append([record_id if header == "Record ID" else (fields.get(header, "New") if header == "Status" else fields.get(header, "")) for header in HEADERS])

        if creates:
            append_range = urllib.parse.quote(f"'{self.tab}'!A:AB", safe="")
            self._request(
                "POST",
                f"/values/{append_range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
                {"majorDimension": "ROWS", "values": creates},
            )
        if updates:
            self._request("POST", "/values:batchUpdate", {"valueInputOption": "RAW", "data": updates})

        summary = {"created": len(creates), "updated": len(updates), "skipped": skipped}
        self.log.info("Google Sheets sync complete: %s", summary)
        return summary
