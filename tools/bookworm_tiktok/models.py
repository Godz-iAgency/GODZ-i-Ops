from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from statistics import mean
from typing import Any


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _integer(value: Any) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


@dataclass(slots=True)
class Video:
    video_id: str | None = None
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    posted_at: str | None = None
    url: str | None = None

    @classmethod
    def from_values(cls, **values: Any) -> "Video":
        return cls(
            video_id=str(values.get("video_id")) if values.get("video_id") else None,
            views=_integer(values.get("views")),
            likes=_integer(values.get("likes")),
            comments=_integer(values.get("comments")),
            shares=_integer(values.get("shares")),
            posted_at=values.get("posted_at"),
            url=values.get("url"),
        )


@dataclass(slots=True)
class Creator:
    key: str
    username: str
    user_id: str | None = None
    display_name: str | None = None
    follower_count: int | None = None
    following_count: int | None = None
    total_likes: int | None = None
    bio: str | None = None
    profile_url: str | None = None
    discovery_sources: list[str] = field(default_factory=list)
    discovery_category: str | None = None
    videos: list[Video] = field(default_factory=list)
    average_views_per_video: float | None = None
    average_engagement_rate_percent: float | None = None
    follower_to_average_views_ratio: float | None = None
    days_since_last_post: int | None = None
    last_post_date: str | None = None
    list_name: str | None = None
    discard_reason: str | None = None

    def merge_identity(self, other: "Creator") -> None:
        for attribute in (
            "user_id",
            "display_name",
            "follower_count",
            "following_count",
            "total_likes",
            "bio",
            "profile_url",
            "discovery_category",
        ):
            incoming = getattr(other, attribute)
            if incoming not in (None, ""):
                setattr(self, attribute, incoming)
        for source in other.discovery_sources:
            if source and source not in self.discovery_sources:
                self.discovery_sources.append(source)
        known_ids = {video.video_id or video.url for video in self.videos}
        for video in other.videos:
            identifier = video.video_id or video.url
            if identifier and identifier not in known_ids:
                self.videos.append(video)
                known_ids.add(identifier)

    def calculate_metrics(self, now: datetime | None = None, recent_video_limit: int = 15) -> None:
        now = now or datetime.now(timezone.utc)
        dated = sorted(self.videos, key=lambda item: item.posted_at or "", reverse=True)
        self.videos = dated[:recent_video_limit]
        valid_views = [video for video in self.videos if video.views is not None and video.views > 0]
        if valid_views:
            self.average_views_per_video = mean(video.views for video in valid_views if video.views is not None)
            rates = [
                ((video.likes or 0) + (video.comments or 0) + (video.shares or 0)) / video.views
                for video in valid_views
                if video.views
            ]
            self.average_engagement_rate_percent = mean(rates) * 100 if rates else None
        if self.average_views_per_video is not None and self.follower_count and self.follower_count > 0:
            self.follower_to_average_views_ratio = self.average_views_per_video / self.follower_count

        timestamps: list[datetime] = []
        for video in self.videos:
            if not video.posted_at:
                continue
            try:
                parsed = datetime.fromisoformat(video.posted_at.replace("Z", "+00:00"))
                timestamps.append(parsed.astimezone(timezone.utc))
            except ValueError:
                continue
        if timestamps:
            latest = max(timestamps)
            self.last_post_date = latest.date().isoformat()
            self.days_since_last_post = max(0, (now - latest).days)

    def normalized(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["discovery_source"] = "; ".join(self.discovery_sources)
        return payload

