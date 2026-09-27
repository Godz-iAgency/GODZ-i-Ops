import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BookwormTikTokFields } from "../lib/database.ts";
import { getGoogleSheetsTable } from "../lib/googleSheets.ts";

type RawItem = Record<string, any>;

const ACTOR_ID = "clockworks~tiktok-scraper";
const TARGET_TOTAL = 1_000;
const MIN_FOLLOWERS = 5_000;
const MIN_VIDEOS = 20;
const SAFETY_BUFFER_USD = 0.05;
const REQUESTED_MAX_SPEND_USD = 3.10;
const FREE_RESULT_PRICE_USD = 0.0037;
const tiktokTable = getGoogleSheetsTable("Bookworm TikTok");

const SEARCH_QUERIES = [
  "booktok creator",
  "book recommendations creator",
  "book review creator",
  "books to read",
  "nonfiction book recommendations",
  "self improvement books",
  "personal development books",
  "self help books",
  "productivity books",
  "habit building books",
  "mindset books",
  "business books",
  "entrepreneurship books",
  "leadership books",
  "finance books",
  "psychology books",
  "book summaries",
  "reading and learning",
  "author book recommendations",
  "must read books",
];

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function apifyJson(url: string, token: string, init: RequestInit = {}) {
  let lastError = "Apify request failed";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.text();
      if (response.ok) return body ? JSON.parse(body) : {};
      lastError = `Apify HTTP ${response.status}: ${body.slice(0, 300)}`;
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000 * 2 ** attempt);
  }
  throw new Error(lastError);
}

function key(value: unknown) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function categoryFor(source: string, bio: string) {
  const value = `${source} ${bio}`.toLowerCase();
  if (/finance|money|wealth|invest/.test(value)) return "Money & Mindset";
  if (/business|entrepreneur|leadership/.test(value)) return "Nonfiction & Business Books";
  if (/productiv|habit/.test(value)) return "Productivity & Habits";
  if (/summary|summaries/.test(value)) return "Book Summaries";
  if (/self.?improvement|self.?help/.test(value)) return "Self-Improvement";
  if (/personal development|mindset|psychology/.test(value)) return "Personal Development";
  if (/booktok|book review|book rec|books to read|must read|author/.test(value)) return "BookTok";
  return "Reading & Learning";
}

function parseCreators(items: RawItem[]) {
  const creators = new Map<string, {
    userId: string;
    username: string;
    displayName: string;
    followers: number;
    following?: number;
    totalLikes?: number;
    videoCount: number;
    bio: string;
    profileUrl: string;
    privateAccount: boolean;
    sources: Set<string>;
  }>();
  for (const item of items) {
    const author = item.authorMeta || item.author || item.profile || item;
    const username = String(author.name || author.username || author.uniqueId || "").trim().replace(/^@/, "");
    const userId = String(author.id || author.userId || item.userId || "").trim();
    if (!username && !userId) continue;
    const creatorKey = key(userId || username);
    const source = String(item.searchQuery || item.input || item.query || "Bookworm TikTok research").trim();
    const current = creators.get(creatorKey);
    const incoming = {
      userId,
      username: username || userId,
      displayName: String(author.nickName || author.nickname || author.displayName || username || userId),
      followers: Number(author.fans ?? author.followers ?? author.followerCount ?? 0),
      following: Number(author.following ?? author.followingCount) || undefined,
      totalLikes: Number(author.heart ?? author.hearts ?? author.likeCount) || undefined,
      videoCount: Number(author.video ?? author.videoCount ?? 0),
      bio: String(author.signature || author.bio || ""),
      profileUrl: String(author.profileUrl || author.url || `https://www.tiktok.com/@${username}`),
      privateAccount: Boolean(author.privateAccount),
      sources: new Set(source ? [source] : []),
    };
    if (!current) creators.set(creatorKey, incoming);
    else {
      incoming.sources.forEach((value) => current.sources.add(value));
      if (incoming.followers > current.followers) Object.assign(current, { ...incoming, sources: current.sources });
    }
  }
  return Array.from(creators.values());
}

async function main() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error("APIFY_API_TOKEN is missing.");

  const [limitsPayload, existing] = await Promise.all([
    apifyJson("https://api.apify.com/v2/users/me/limits", token),
    tiktokTable.select().all(),
  ]);
  const limits = limitsPayload.data || {};
  const limitUsd = Number(limits.limits?.maxMonthlyUsageUsd || 0);
  const usedUsd = Number(limits.current?.monthlyUsageUsd || 0);
  const remainingUsd = Math.max(0, limitUsd - usedUsd);
  const maxSpendUsd = Math.min(REQUESTED_MAX_SPEND_USD, Math.max(0, remainingUsd - SAFETY_BUFFER_USD));
  const resumeRunId = process.argv.find((value) => value.startsWith("--run-id="))?.split("=")[1];
  if (!resumeRunId && maxSpendUsd < 0.5) throw new Error(`Only $${remainingUsd.toFixed(2)} remains; Apify requires a $0.50 run ceiling.`);

  const existingKeys = new Set(existing.flatMap((creator) => [key(creator.fields["TikTok User ID"]), key(creator.fields["TikTok Handle"])]).filter(Boolean));
  const needed = Math.max(0, TARGET_TOTAL - existingKeys.size);
  if (!needed) {
    console.log(JSON.stringify({ message: "The TikTok bank already contains at least 1,000 unique creators.", total: existingKeys.size }, null, 2));
    return;
  }
  const affordableResults = Math.max(1, Math.floor((maxSpendUsd - 0.001) / FREE_RESULT_PRICE_USD));
  const profilesPerQuery = Math.max(1, Math.ceil(Math.min(1_200, needed + 250, affordableResults) / SEARCH_QUERIES.length));
  let runId = resumeRunId || "";
  let run: RawItem | null = null;
  if (runId) {
    const payload = await apifyJson(`https://api.apify.com/v2/actor-runs/${runId}`, token);
    run = payload.data || {};
    if (run?.status !== "SUCCEEDED") throw new Error(`Apify run ${runId} is ${run?.status || "unknown"}; resume it after it succeeds.`);
    console.log(`Resuming completed Apify run ${runId}; no new scrape was started.`);
  } else {
    console.log(`Starting a capped Apify run: up to $${maxSpendUsd.toFixed(2)}, approximately ${affordableResults} results.`);
    const started = await apifyJson(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?maxTotalChargeUsd=${maxSpendUsd.toFixed(2)}`, token, {
      method: "POST",
      body: JSON.stringify({
        searchQueries: SEARCH_QUERIES,
        searchSection: "/user",
        maxProfilesPerQuery: profilesPerQuery,
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadAvatars: false,
        shouldDownloadMusicCovers: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
    runId = started.data?.id || "";
    if (!runId) throw new Error("Apify did not return a run ID.");
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline) {
      await sleep(5_000);
      const payload = await apifyJson(`https://api.apify.com/v2/actor-runs/${runId}`, token);
      const currentRun: RawItem = payload.data || {};
      run = currentRun;
      process.stdout.write(`\rApify: ${currentRun.status || "RUNNING"} · ${currentRun.stats?.durationMillis ? Math.round(currentRun.stats.durationMillis / 1000) : 0}s`);
      if (currentRun.status === "SUCCEEDED") break;
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(currentRun.status)) throw new Error(`Apify run ${currentRun.status}: ${currentRun.statusMessage || ""}`);
    }
    console.log();
  }
  if (!run || run.status !== "SUCCEEDED" || !run.defaultDatasetId) throw new Error(`Apify run ${runId} did not finish in time.`);

  const items = await apifyJson(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=100000`, token);
  if (!Array.isArray(items)) throw new Error("Apify returned an invalid dataset.");
  const parsed = parseCreators(items);
  const candidates = parsed
    .filter((creator) => !creator.privateAccount && creator.followers >= MIN_FOLLOWERS && creator.videoCount >= MIN_VIDEOS)
    .filter((creator) => !existingKeys.has(key(creator.userId)) && !existingKeys.has(key(creator.username)))
    .sort((a, b) => b.sources.size - a.sources.size || b.followers - a.followers)
    .slice(0, needed);

  const cached = {
    runId,
    createdAt: new Date().toISOString(),
    rawResults: items.length,
    uniqueProfiles: parsed.length,
    candidates: candidates.map((creator) => ({ ...creator, sources: Array.from(creator.sources) })),
  };
  const cacheDir = path.join(process.cwd(), ".cache", "bookworm-tiktok");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, `candidate-bank-${runId}.json`), JSON.stringify(cached, null, 2), "utf8");

  const rows = candidates.map((creator) => {
    const source = Array.from(creator.sources).join("; ");
    const niche = categoryFor(source, creator.bio);
    return {
      fields: {
        Name: creator.displayName || creator.username,
        "Display Name": creator.displayName || creator.username,
        "TikTok User ID": creator.userId || undefined,
        "TikTok Handle": `@${creator.username}`,
        "TikTok URL": creator.profileUrl || `https://www.tiktok.com/@${creator.username}`,
        Followers: Math.round(creator.followers),
        Following: creator.following == null ? undefined : Math.round(creator.following),
        "Total Likes": creator.totalLikes == null ? undefined : Math.round(creator.totalLikes),
        Bio: creator.bio || undefined,
        "Discovery Source": source,
        "Discovery Category": niche,
        List: "Candidate",
        Excluded: false,
        Niche: niche,
        Status: "New",
        Notes: "Profile-level candidate. Recent videos and engagement have not been deeply verified yet.",
        "Next Action": "Awaiting deep qualification",
      } satisfies BookwormTikTokFields,
    };
  });

  for (let index = 0; index < rows.length; index += 200) {
    await tiktokTable.create(rows.slice(index, index + 200));
    console.log(`Saved ${Math.min(index + 200, rows.length)} of ${rows.length} candidates to Google Sheets.`);
  }

  const result = {
    runId,
    maximumSpendUsd: Number(run.options?.maxTotalChargeUsd || (resumeRunId ? run.usageTotalUsd : maxSpendUsd) || 0),
    actualSpendUsd: Number(run.usageTotalUsd || 0),
    rawResults: items.length,
    uniqueProfiles: parsed.length,
    passedProfileScreen: candidates.length,
    existingBefore: existing.length,
    totalAfter: existing.length + candidates.length,
    criteria: { minimumFollowers: MIN_FOLLOWERS, minimumVideos: MIN_VIDEOS, publicProfilesOnly: true, maximumFollowers: null },
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
