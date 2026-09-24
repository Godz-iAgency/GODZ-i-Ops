from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from .models import Creator, Video


def _first(*values: Any) -> Any:
    return next((value for value in values if value not in (None, "")), None)


def _nested(item: dict[str, Any], *path: str) -> Any:
    current: Any = item
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _iso_timestamp(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).isoformat().replace("+00:00", "Z")
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def _integer(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _source(item: dict[str, Any], fallback: str | None) -> str:
    source = item.get("source")
    if isinstance(source, dict):
        value = _first(source.get("value"), source.get("name"))
        if value:
            return f"{source.get('type', 'source')}:{value}"
    hashtag = item.get("hashtagMeta")
    if isinstance(hashtag, dict) and hashtag.get("name"):
        return f"hashtag:{hashtag['name']}"
    value = _first(item.get("searchQuery"), item.get("query"), item.get("input"))
    return str(value or fallback or "discovery")


def parse_item(item: dict[str, Any], fallback_source: str | None = None) -> Creator | None:
    if item.get("errorCode"):
        return None
    author = item.get("authorMeta") or item.get("author") or item.get("profile") or {}
    if not isinstance(author, dict):
        author = {}
    username = _first(
        author.get("name"),
        author.get("username"),
        author.get("uniqueId"),
        item.get("username") if item.get("type") == "profile" else None,
        item.get("authorName"),
    )
    user_id = _first(author.get("id"), author.get("userId"), item.get("userId"), item.get("profileId"))
    if not username and not user_id:
        return None
    username = str(username or user_id).lstrip("@")
    key = str(user_id or username).lower()
    creator = Creator(
        key=key,
        username=username,
        user_id=str(user_id) if user_id else None,
        display_name=_first(author.get("nickName"), author.get("nickname"), author.get("displayName"), item.get("name") if item.get("type") == "profile" else None),
        follower_count=_integer(_first(author.get("fans"), author.get("followers"), author.get("followerCount"), item.get("followerCount"))),
        following_count=_integer(_first(author.get("following"), author.get("followingCount"), item.get("followingCount"))),
        total_likes=_integer(_first(author.get("heart"), author.get("hearts"), author.get("likeCount"), item.get("likeCount"))),
        bio=_first(author.get("signature"), author.get("bio"), item.get("bio")),
        profile_url=_first(author.get("profileUrl"), author.get("url"), item.get("profileUrl"), item.get("url") if item.get("type") == "profile" else None),
        discovery_sources=[_source(item, fallback_source)],
    )
    video_id = _first(item.get("id"), item.get("videoId"))
    views = _first(item.get("playCount"), item.get("viewCount"), item.get("views"), _nested(item, "stats", "playCount"))
    if video_id or views is not None:
        creator.videos.append(
            Video.from_values(
                video_id=video_id,
                views=views,
                likes=_first(item.get("diggCount"), item.get("likeCount"), item.get("likes"), _nested(item, "stats", "diggCount")),
                comments=_first(item.get("commentCount"), item.get("comments"), _nested(item, "stats", "commentCount")),
                shares=_first(item.get("shareCount"), item.get("shares"), _nested(item, "stats", "shareCount")),
                posted_at=_iso_timestamp(_first(item.get("createTimeISO"), item.get("createdAt"), item.get("createTime"))),
                url=_first(item.get("webVideoUrl"), item.get("videoUrl"), item.get("url") if item.get("type") != "profile" else None),
            )
        )
    return creator


def parse_items(items: Iterable[dict[str, Any]], fallback_source: str | None = None) -> tuple[dict[str, Creator], int]:
    creators: dict[str, Creator] = {}
    errors = 0
    for item in items:
        if item.get("errorCode"):
            errors += 1
            continue
        parsed = parse_item(item, fallback_source)
        if not parsed:
            continue
        existing = creators.get(parsed.key)
        if existing:
            existing.merge_identity(parsed)
        else:
            creators[parsed.key] = parsed
    return creators, errors


def merge_creator_maps(target: dict[str, Creator], incoming: dict[str, Creator]) -> None:
    username_index = {creator.username.lower(): key for key, creator in target.items()}
    for key, creator in incoming.items():
        target_key = key if key in target else username_index.get(creator.username.lower())
        if target_key:
            target[target_key].merge_identity(creator)
        else:
            target[key] = creator
            username_index[creator.username.lower()] = key
