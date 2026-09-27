import {
  type BookwormTikTokFields,
  getAllBookwormTikTokCreators,
  getBookwormTikTokTable,
} from "@/lib/database";

type RawItem = Record<string, unknown>;
type Video = {
  id?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  postedAt?: string;
  url?: string;
};

type Creator = {
  key: string;
  username: string;
  userId?: string;
  displayName?: string;
  followers?: number;
  following?: number;
  totalLikes?: number;
  bio?: string;
  profileUrl?: string;
  sources: string[];
  videos: Video[];
  averageViews?: number;
  engagementRate?: number;
  reachRatio?: number;
  daysSinceLastPost?: number;
  lastPostDate?: string;
  validVideoCount: number;
};

export type TikTokResearchResult = {
  added: number;
  readyBefore: number;
  readyAfter: number;
  discovered: number;
  uniqueCreators: number;
  enriched: number;
  qualified: number;
  estimatedMaximumSpendUsd: number;
  message: string;
};

const ACTOR_ID = "clockworks~tiktok-scraper";
const HASHTAGS = [
  "selfimprovement",
  "personaldevelopment",
  "selfhelp",
  "bookrecommendations",
  "nonfictionbooks",
  "productivitytips",
  "mindset",
  "booktok",
];
const SEARCH_QUERIES = [
  "self improvement books",
  "personal development books",
  "best self help books",
  "productivity book recommendations",
];

const RESULTS_PER_SOURCE = 5;
const PROFILE_LIMIT = 25;
const RECENT_VIDEOS = 8;
const TARGET_READY = 10;
const MIN_FOLLOWERS = 10_000;
const MIN_ENGAGEMENT = 3;
const MAX_DAYS_SINCE_POST = 14;
const MIN_AVERAGE_VIEWS = 5_000;
const MIN_REACH_RATIO = 0.2;
const MIN_VALID_VIDEOS = 6;
// Conservative estimate based on the project's $3.70 / 1,000-result guard.
const ESTIMATED_MAXIMUM_SPEND_USD = 0.97;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function object(value: unknown): RawItem {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawItem : {};
}

function first<T>(...values: Array<T | null | undefined | "">): T | undefined {
  return values.find((value) => value !== null && value !== undefined && value !== "") as T | undefined;
}

function number(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: unknown): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

function timestamp(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function nested(item: RawItem, parent: string, child: string): unknown {
  return object(item[parent])[child];
}

function sourceFor(item: RawItem, fallback: string): string {
  const source = object(item.source);
  const sourceValue = first(text(source.value), text(source.name));
  if (sourceValue) return `${text(source.type) || "source"}:${sourceValue}`;
  const hashtag = object(item.hashtagMeta);
  if (hashtag.name) return `hashtag:${hashtag.name}`;
  return text(first(item.searchQuery, item.query, item.input)) || fallback;
}

function parseItem(item: RawItem, fallbackSource: string): Creator | null {
  if (item.errorCode) return null;
  const author = object(first(item.authorMeta, item.author, item.profile));
  const username = text(first(
    author.name,
    author.username,
    author.uniqueId,
    item.type === "profile" ? item.username : undefined,
    item.authorName,
  ))?.replace(/^@/, "");
  const userId = text(first(author.id, author.userId, item.userId, item.profileId));
  if (!username && !userId) return null;

  const resolvedUsername = username || userId!;
  const enrichment = fallbackSource.startsWith("profile-batch:");
  const videoId = text(first(item.id, item.videoId));
  const views = number(first(item.playCount, item.viewCount, item.views, nested(item, "stats", "playCount")));
  const videos: Video[] = [];
  if (videoId || views !== undefined) {
    videos.push({
      id: videoId,
      views,
      likes: number(first(item.diggCount, item.likeCount, item.likes, nested(item, "stats", "diggCount"))),
      comments: number(first(item.commentCount, item.comments, nested(item, "stats", "commentCount"))),
      shares: number(first(item.shareCount, item.shares, nested(item, "stats", "shareCount"))),
      postedAt: timestamp(first(item.createTimeISO, item.createdAt, item.createTime)),
      url: text(first(item.webVideoUrl, item.videoUrl, item.type !== "profile" ? item.url : undefined)),
    });
  }

  return {
    key: (userId || resolvedUsername).toLowerCase(),
    username: resolvedUsername,
    userId,
    displayName: text(first(author.nickName, author.nickname, author.displayName, item.type === "profile" ? item.name : undefined)),
    followers: number(first(author.fans, author.followers, author.followerCount, item.followerCount)),
    following: number(first(author.following, author.followingCount, item.followingCount)),
    totalLikes: number(first(author.heart, author.hearts, author.likeCount, item.likeCount)),
    bio: text(first(author.signature, author.bio, item.bio)),
    profileUrl: text(first(author.profileUrl, author.url, item.profileUrl, item.type === "profile" ? item.url : undefined)),
    sources: enrichment ? [] : [sourceFor(item, fallbackSource)],
    videos,
    validVideoCount: 0,
  };
}

function mergeCreator(target: Creator, incoming: Creator) {
  for (const key of ["userId", "displayName", "followers", "following", "totalLikes", "bio", "profileUrl"] as const) {
    const value = incoming[key];
    if (value !== undefined && value !== "") Object.assign(target, { [key]: value });
  }
  for (const source of incoming.sources) if (source && !target.sources.includes(source)) target.sources.push(source);
  const knownVideos = new Set(target.videos.map((video) => video.id || video.url).filter(Boolean));
  for (const video of incoming.videos) {
    const key = video.id || video.url;
    if (key && !knownVideos.has(key)) {
      target.videos.push(video);
      knownVideos.add(key);
    }
  }
}

function mergeItems(target: Map<string, Creator>, items: RawItem[], fallbackSource: string) {
  const usernameIndex = new Map(Array.from(target.entries()).map(([key, creator]) => [creator.username.toLowerCase(), key]));
  for (const item of items) {
    const creator = parseItem(item, fallbackSource);
    if (!creator) continue;
    const targetKey = target.has(creator.key) ? creator.key : usernameIndex.get(creator.username.toLowerCase());
    if (targetKey) mergeCreator(target.get(targetKey)!, creator);
    else {
      target.set(creator.key, creator);
      usernameIndex.set(creator.username.toLowerCase(), creator.key);
    }
  }
}

function calculateMetrics(creator: Creator) {
  creator.videos = creator.videos
    .sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))
    .slice(0, RECENT_VIDEOS);
  const valid = creator.videos.filter((video) => (video.views || 0) > 0);
  creator.validVideoCount = valid.length;
  if (valid.length) {
    creator.averageViews = valid.reduce((sum, video) => sum + (video.views || 0), 0) / valid.length;
    creator.engagementRate = valid.reduce((sum, video) => {
      return sum + ((video.likes || 0) + (video.comments || 0) + (video.shares || 0)) / (video.views || 1);
    }, 0) / valid.length * 100;
  }
  if (creator.averageViews !== undefined && (creator.followers || 0) > 0) {
    creator.reachRatio = creator.averageViews / creator.followers!;
  }
  const dates = creator.videos.map((video) => video.postedAt ? new Date(video.postedAt) : null)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
  if (dates.length) {
    const latest = new Date(Math.max(...dates.map((date) => date.getTime())));
    creator.lastPostDate = latest.toISOString().slice(0, 10);
    creator.daysSinceLastPost = Math.max(0, Math.floor((Date.now() - latest.getTime()) / 86_400_000));
  }
}

function qualifies(creator: Creator) {
  return (creator.followers || 0) >= MIN_FOLLOWERS
    && (creator.engagementRate || 0) >= MIN_ENGAGEMENT
    && (creator.daysSinceLastPost ?? Number.POSITIVE_INFINITY) <= MAX_DAYS_SINCE_POST
    && (creator.averageViews || 0) >= MIN_AVERAGE_VIEWS
    && (creator.reachRatio || 0) >= MIN_REACH_RATIO
    && creator.validVideoCount >= MIN_VALID_VIDEOS;
}

function rankScore(creator: Creator) {
  const engagement = Math.min(creator.engagementRate || 0, 15) / 15 * 35;
  const reach = Math.min(creator.reachRatio || 0, 1) * 25;
  const recency = Math.max(0, MAX_DAYS_SINCE_POST - (creator.daysSinceLastPost || 0)) / MAX_DAYS_SINCE_POST * 15;
  const views = Math.min(Math.log10(Math.max(creator.averageViews || 1, 1)) / 6, 1) * 15;
  const audience = Math.min(Math.log10(Math.max(creator.followers || 1, 1)) / 7, 1) * 10;
  return engagement + reach + recency + views + audience;
}

function existingReady(fields: BookwormTikTokFields) {
  const contacted = !!fields["Date Contacted"] || !["", "New"].includes(fields.Status || "New");
  return !fields.Excluded
    && !contacted
    && (fields.Followers || 0) >= MIN_FOLLOWERS
    && (fields["Average Engagement Rate %"] || 0) >= MIN_ENGAGEMENT
    && (fields["Days Since Last Post"] ?? Number.POSITIVE_INFINITY) <= MAX_DAYS_SINCE_POST
    && (fields["Average Views"] || 0) >= MIN_AVERAGE_VIEWS
    && (fields["Follower To Avg Views Ratio"] || 0) >= MIN_REACH_RATIO;
}

async function apifyJson(path: string, token: string, init?: RequestInit): Promise<unknown> {
  let lastError = "Apify request failed";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`https://api.apify.com/v2${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
      if (response.ok) return await response.json();
      lastError = `Apify returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000 * 2 ** attempt);
  }
  throw new Error(lastError);
}

async function runActor(token: string, input: RawItem): Promise<RawItem[]> {
  const started = object(await apifyJson(`/acts/${ACTOR_ID}/runs`, token, { method: "POST", body: JSON.stringify(input) }));
  const run = object(started.data);
  const runId = text(run.id);
  if (!runId) throw new Error("Apify did not return a run ID.");

  const deadline = Date.now() + 140_000;
  while (Date.now() < deadline) {
    const statusPayload = object(await apifyJson(`/actor-runs/${runId}`, token));
    const state = object(statusPayload.data);
    const status = text(state.status);
    if (status === "SUCCEEDED") {
      const datasetId = text(state.defaultDatasetId);
      if (!datasetId) throw new Error("Apify completed without a result dataset.");
      const items = await apifyJson(`/datasets/${datasetId}/items?clean=true&format=json`, token);
      return Array.isArray(items) ? items.map(object) : [];
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status || "")) {
      throw new Error(`Apify research ended with status ${status}.`);
    }
    await sleep(3_000);
  }
  throw new Error("Apify research took too long. Check the run in Apify before starting another one.");
}

function keyForExisting(fields: BookwormTikTokFields) {
  return String(fields["TikTok User ID"] || fields["TikTok Handle"] || "").trim().replace(/^@/, "").toLowerCase();
}

async function executeResearch(): Promise<TikTokResearchResult> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error("APIFY_API_TOKEN is not configured in Vercel.");

  const existing = await getAllBookwormTikTokCreators();
  const readyBefore = existing.filter((creator) => existingReady(creator.fields)).length;
  if (readyBefore >= TARGET_READY) {
    return {
      added: 0, readyBefore, readyAfter: readyBefore, discovered: 0, uniqueCreators: 0, enriched: 0,
      qualified: readyBefore, estimatedMaximumSpendUsd: 0,
      message: `You already have ${readyBefore} qualified creators ready to contact, so no Apify credit was used.`,
    };
  }

  const common = {
    resultsPerPage: RESULTS_PER_SOURCE,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    shouldDownloadSlideshowImages: false,
  };
  const [hashtagItems, searchItems] = await Promise.all([
    runActor(token, { ...common, hashtags: HASHTAGS }),
    runActor(token, { ...common, searchQueries: SEARCH_QUERIES }),
  ]);

  const creators = new Map<string, Creator>();
  mergeItems(creators, hashtagItems, "hashtag-discovery");
  mergeItems(creators, searchItems, "search-discovery");
  for (const creator of creators.values()) calculateMetrics(creator);

  const existingKeys = new Set(existing.map((creator) => keyForExisting(creator.fields)).filter(Boolean));
  const candidates = Array.from(creators.values())
    .filter((creator) => !existingKeys.has((creator.userId || creator.username).toLowerCase()) && !existingKeys.has(creator.username.toLowerCase()))
    .sort((a, b) => {
      const aLikely = Number((a.followers || 0) >= MIN_FOLLOWERS) + Number((a.engagementRate || 0) >= MIN_ENGAGEMENT);
      const bLikely = Number((b.followers || 0) >= MIN_FOLLOWERS) + Number((b.engagementRate || 0) >= MIN_ENGAGEMENT);
      return bLikely - aLikely || (b.engagementRate || 0) - (a.engagementRate || 0) || (b.followers || 0) - (a.followers || 0);
    })
    .slice(0, PROFILE_LIMIT);

  if (!candidates.length) {
    return {
      added: 0, readyBefore, readyAfter: readyBefore, discovered: hashtagItems.length + searchItems.length,
      uniqueCreators: creators.size, enriched: 0, qualified: 0,
      estimatedMaximumSpendUsd: ESTIMATED_MAXIMUM_SPEND_USD,
      message: "Apify found results, but none were new creators. No records were added.",
    };
  }

  const profileItems = await runActor(token, {
    profiles: candidates.map((creator) => creator.username),
    resultsPerPage: RECENT_VIDEOS,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: true,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
  });
  mergeItems(creators, profileItems, "profile-batch:1");

  const candidateNames = new Set(candidates.map((creator) => creator.username.toLowerCase()));
  const qualified = Array.from(creators.values())
    .filter((creator) => candidateNames.has(creator.username.toLowerCase()))
    .map((creator) => { calculateMetrics(creator); return creator; })
    .filter(qualifies)
    .sort((a, b) => rankScore(b) - rankScore(a));

  const needed = Math.max(0, TARGET_READY - readyBefore);
  const selected = qualified.slice(0, needed);
  if (selected.length) {
    const enrichedAt = new Date().toISOString();
    await getBookwormTikTokTable().create(selected.map((creator) => ({
      fields: {
        Name: creator.displayName || creator.username,
        "Display Name": creator.displayName || creator.username,
        "TikTok User ID": creator.userId,
        "TikTok Handle": `@${creator.username}`,
        "TikTok URL": creator.profileUrl || `https://www.tiktok.com/@${creator.username}`,
        Followers: Math.round(creator.followers || 0),
        Following: creator.following == null ? undefined : Math.round(creator.following),
        "Total Likes": creator.totalLikes == null ? undefined : Math.round(creator.totalLikes),
        "Average Views": Math.round(creator.averageViews || 0),
        "Average Engagement Rate %": Number((creator.engagementRate || 0).toFixed(3)),
        "Follower To Avg Views Ratio": Number((creator.reachRatio || 0).toFixed(4)),
        "Days Since Last Post": creator.daysSinceLastPost,
        "Last Post Date": creator.lastPostDate,
        Bio: creator.bio,
        "Discovery Source": creator.sources.join("; "),
        "Discovery Category": creator.sources[0] || "Bookworm research",
        List: "Primary",
        Excluded: false,
        "Enriched At": enrichedAt,
        Status: "New",
        "Next Action": "Review profile and send a personalized partnership DM",
      } satisfies BookwormTikTokFields,
    })), { typecast: true });
  }

  const readyAfter = readyBefore + selected.length;
  return {
    added: selected.length,
    readyBefore,
    readyAfter,
    discovered: hashtagItems.length + searchItems.length,
    uniqueCreators: creators.size,
    enriched: candidates.length,
    qualified: qualified.length,
    estimatedMaximumSpendUsd: ESTIMATED_MAXIMUM_SPEND_USD,
    message: selected.length
      ? `Added ${selected.length} qualified creator${selected.length === 1 ? "" : "s"}. Your queue now has ${readyAfter} ready to contact.`
      : "The run completed, but no new creators met every qualification requirement. Try again later with different discovery terms.",
  };
}

let activeResearch: Promise<TikTokResearchResult> | null = null;

export function runBookwormTikTokResearch() {
  if (activeResearch) return activeResearch;
  activeResearch = executeResearch().finally(() => { activeResearch = null; });
  return activeResearch;
}

export const BOOKWORM_TIKTOK_RESEARCH_CRITERIA = {
  targetReady: TARGET_READY,
  minimumFollowers: MIN_FOLLOWERS,
  minimumEngagementPercent: MIN_ENGAGEMENT,
  activeWithinDays: MAX_DAYS_SINCE_POST,
  minimumAverageViews: MIN_AVERAGE_VIEWS,
  minimumReachRatio: MIN_REACH_RATIO,
  minimumValidVideos: MIN_VALID_VIDEOS,
  estimatedMaximumSpendUsd: ESTIMATED_MAXIMUM_SPEND_USD,
};
