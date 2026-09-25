# Bookworm TikTok creator research

This standalone Python CLI discovers TikTok creators with the Apify Actor
`clockworks/tiktok-scraper`, deduplicates them before profile enrichment,
calculates qualification metrics, and optionally syncs qualified creators to
the existing Airtable `Bookworm TikTok Creators` table.

It does not replace or run inside the Next.js application. It produces:

- `primary_creators.csv`
- `reserve_creators.csv`
- `creators.normalized.json`
- `run-summary.json`
- `pipeline.log`

Generated outputs and raw caches are ignored by Git.

## Commands

From the repository root:

```powershell
python -m tools.bookworm_tiktok --dry-run
python -m tools.bookworm_tiktok --results-per-source 1 --max-creators 1
python -m tools.bookworm_tiktok --budget-usd 5 --sync-airtable --refresh
```

The first command validates configuration without using Apify. The second is a
small live schema test. The third runs the budget-capped production discovery
and upserts primary and reserve creators to Airtable table
`tblKOYrjzZS8xdl60` (`Bookworm TikTok Creators`). The Command Center's
Bookworm → TikTok screen reads that same table, and every result includes a
direct TikTok profile link.

The default $5 plan reserves $0.10 as a safety margin. At the configured free
plan price it requests up to 20 results from each of 12 discovery sources, then
enriches the 108 most promising unique creators with their 10 latest videos.
Discovery evidence is used to prioritize likely Primary matches before the
paid profile step. The CLI prints the maximum estimated spend before it starts.

Use `APIFY_API_TOKEN`. The existing `APIFY_API_KEY` name remains supported as a
legacy alias. Airtable sync additionally uses `AIRTABLE_PAT` and
`AIRTABLE_BASE_MUSIC`.

Edit `config/bookworm_tiktok.json` to change discovery terms, limits,
qualification thresholds, batching, or ranking. The ranking strategy is kept
separate so a future Bookworm Creator Score can be added without changing the
scraper or normalized record shape.

## Metric definition

`Follower To Avg Views Ratio = Average Views Per Video / Follower Count`

A value of `0.50` means recent videos average views equal to about half of the
creator's follower count. Missing or zero follower counts produce a null ratio.
