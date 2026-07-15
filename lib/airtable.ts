import Airtable from "airtable";

const PAT = process.env.AIRTABLE_PAT;
const BASE_MUSIC = process.env.AIRTABLE_BASE_MUSIC;
const BASE_APPS = process.env.AIRTABLE_BASE_APPS;

if (!PAT || !BASE_MUSIC || !BASE_APPS) {
  throw new Error("Missing Airtable env vars: AIRTABLE_PAT, AIRTABLE_BASE_MUSIC, AIRTABLE_BASE_APPS");
}

Airtable.configure({ apiKey: PAT });

export type Tier = "godzi" | "splitmic" | "gbombs" | "bookworm" | "hotcake";

export const TIERS: Record<Tier, { label: string; baseId: string; table: string; tableId: string; color: string }> = {
  godzi: { label: "GODZ-i", baseId: BASE_MUSIC, table: "Website", tableId: "tblggdK3pO76ELx0v", color: "#F2C94C" },
  splitmic: { label: "SplitMic", baseId: BASE_MUSIC, table: "SplitMic", tableId: "tblTDMthhQVuKEyzJ", color: "#56CCF2" },
  gbombs: { label: "gBOMBS", baseId: BASE_APPS, table: "g-BOMBS Leads", tableId: "tblGKon7vSpqaPkWm", color: "#EF6C9E" },
  bookworm: { label: "Bookworm", baseId: BASE_APPS, table: "BookWorm Leads", tableId: "tblcLI6qSrZDdzkjt", color: "#C9A66B" },
  hotcake: { label: "HotCake", baseId: BASE_APPS, table: "HotCake Leads", tableId: "tbl60EXsrcQ8zgXGw", color: "#5FBF7A" },
};

export function getTable(tier: Tier) {
  const cfg = TIERS[tier];
  return new Airtable().base(cfg.baseId)(cfg.table);
}

// Fields shared across all 5 tables after schema unification.
export const FIELDS = [
  "Name",
  "Category",
  "Channel",
  "Channel Handle",
  "Email",
  "Phone",
  "Address",
  "Stage",
  "Last Contact",
  "Next Action",
  "Notes",
] as const;

export type LeadFields = {
  Name?: string;
  Category?: string;
  Channel?: string[];
  "Channel Handle"?: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  Stage?: string;
  "Last Contact"?: string;
  "Next Action"?: string;
  Notes?: string;
};

export type Lead = { id: string; fields: LeadFields };
