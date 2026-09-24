from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class ApifyError(RuntimeError):
    pass


class ApifyClient:
    def __init__(
        self,
        token: str,
        actor_id: str,
        *,
        timeout_seconds: int = 900,
        poll_interval_seconds: int = 5,
        max_retries: int = 4,
    ) -> None:
        self.token = token
        self.actor_id = actor_id.replace("/", "~")
        self.timeout_seconds = timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self.max_retries = max_retries
        self.base_url = "https://api.apify.com/v2"
        self.log = logging.getLogger("bookworm_tiktok.apify")

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                request = urllib.request.Request(url, data=body, headers=headers, method=method)
                with urllib.request.urlopen(request, timeout=min(self.timeout_seconds, 120)) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                response_text = error.read().decode("utf-8", errors="replace")[:500]
                last_error = ApifyError(f"Apify HTTP {error.code}: {response_text}")
                if error.code not in (408, 429, 500, 502, 503, 504) or attempt >= self.max_retries:
                    raise last_error from error
                retry_after = error.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else min(30, 2 ** attempt)
                self.log.warning("Apify request throttled or unavailable; retrying in %.1fs", delay)
                time.sleep(delay)
            except (urllib.error.URLError, TimeoutError) as error:
                last_error = error
                if attempt >= self.max_retries:
                    break
                delay = min(30, 2 ** attempt)
                self.log.warning("Apify network error; retrying in %.1fs: %s", delay, error)
                time.sleep(delay)
        raise ApifyError(f"Apify request failed after retries: {last_error}")

    def run_actor(self, actor_input: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
        started = self._request("POST", f"/acts/{self.actor_id}/runs", actor_input)
        run = started.get("data") or {}
        run_id = run.get("id")
        if not run_id:
            raise ApifyError("Apify did not return a run ID")
        self.log.info("Started Actor run %s", run_id)
        deadline = time.monotonic() + self.timeout_seconds
        while time.monotonic() < deadline:
            state = (self._request("GET", f"/actor-runs/{run_id}").get("data") or {})
            status = state.get("status")
            if status == "SUCCEEDED":
                dataset_id = state.get("defaultDatasetId")
                if not dataset_id:
                    raise ApifyError(f"Actor run {run_id} finished without a dataset")
                items = self._request("GET", f"/datasets/{dataset_id}/items?clean=true&format=json")
                return run_id, items if isinstance(items, list) else []
            if status in {"FAILED", "ABORTED", "TIMED-OUT"}:
                raise ApifyError(f"Actor run {run_id} ended with status {status}")
            time.sleep(self.poll_interval_seconds)
        raise ApifyError(f"Actor run {run_id} exceeded {self.timeout_seconds} seconds")

