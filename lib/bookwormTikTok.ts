// The niches Bookworm's TikTok creators are filed under. One list feeds the
// TikTok board's niche filter, the Today logger, and the search-term groups on
// the Search tab, so a creator found under a heading there files under the
// same name here.
export const TIKTOK_NICHES = [
  "BookTok",
  "Self-Improvement",
  "Personal Development",
  "Book Summaries",
  "E-books & Kindle",
  "Nonfiction & Business Books",
  "Productivity & Habits",
  "Reading & Learning",
  "Money & Mindset",
  "Other",
] as const;

export type TikTokNiche = (typeof TIKTOK_NICHES)[number];

export const TIKTOK_DAILY_GOAL = 10;
