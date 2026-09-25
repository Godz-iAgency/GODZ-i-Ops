"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, ExternalLink, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import { austinDateStr } from "@/lib/austinDate";

type Fields = {
  Name?: string;
  "Display Name"?: string;
  "TikTok User ID"?: string;
  "TikTok Handle"?: string;
  "TikTok URL"?: string;
  Followers?: number;
  Following?: number;
  "Total Likes"?: number;
  "Average Views"?: number;
  "Average Engagement Rate %"?: number;
  "Follower To Avg Views Ratio"?: number;
  "Days Since Last Post"?: number;
  "Last Post Date"?: string;
  Bio?: string;
  "Discovery Source"?: string;
  "Discovery Category"?: string;
  Niche?: string;
  List?: string;
  Excluded?: boolean;
  "Date Contacted"?: string;
  Status?: string;
  Notes?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
};

type Creator = { id: string; fields: Fields };
type ContactFilter = "Not Contacted" | "Contacted" | "All";

const input = "w-full rounded-xl border border-border bg-black/25 px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent";
const statuses = ["New", "DM Sent", "Replied", "In Talks", "Partnered", "Not Interested"];

function compact(value?: number) {
  if (value == null) return "—";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function isContacted(creator: Creator) {
  return !!creator.fields["Date Contacted"] || !["", "New"].includes(creator.fields.Status || "New");
}

function profileUrl(fields: Fields) {
  if (fields["TikTok URL"]) return fields["TikTok URL"];
  const username = (fields["TikTok Handle"] || "").replace(/^@/, "");
  return username ? `https://www.tiktok.com/@${encodeURIComponent(username)}` : "";
}

export default function QualifiedTikTokBoard() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState("Primary");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("Not Contacted");
  const [minFollowers, setMinFollowers] = useState(10_000);
  const [maxFollowers, setMaxFollowers] = useState(300_000);
  const [minEngagement, setMinEngagement] = useState(3);
  const [maxDays, setMaxDays] = useState(14);
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Creator | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCreator, setNewCreator] = useState<Fields>({ Status: "New", List: "Primary" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bookworm-tiktok");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load TikTok creators");
      setCreators(data.creators || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load TikTok creators");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (creator: Creator, fields: Fields) => {
    setSaving(creator.id);
    setError(null);
    try {
      const response = await fetch(`/api/bookworm-tiktok/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update creator");
      setCreators((current) => current.map((item) => item.id === data.id ? data : item));
      setSelected((current) => current?.id === data.id ? data : current);
      return data as Creator;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update creator");
      return null;
    } finally {
      setSaving(null);
    }
  };

  const create = async () => {
    setSaving("new");
    setError(null);
    try {
      const response = await fetch("/api/bookworm-tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCreator),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save creator");
      setCreators((current) => [data, ...current]);
      setNewCreator({ Status: "New", List: "Primary" });
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save creator");
    } finally {
      setSaving(null);
    }
  };

  const categories = useMemo(() => [...new Set(creators.map((item) => item.fields["Discovery Category"] || item.fields.Niche).filter(Boolean) as string[])].sort(), [creators]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return creators
      .filter((creator) => {
        const fields = creator.fields;
        if (fields.Excluded) return false;
        if (listFilter !== "All" && (fields.List || "Primary") !== listFilter) return false;
        if (contactFilter === "Not Contacted" && isContacted(creator)) return false;
        if (contactFilter === "Contacted" && !isContacted(creator)) return false;
        if (fields.Followers != null && (fields.Followers < minFollowers || fields.Followers > maxFollowers)) return false;
        if ((fields["Average Engagement Rate %"] ?? 0) < minEngagement) return false;
        if ((fields["Days Since Last Post"] ?? Number.POSITIVE_INFINITY) > maxDays) return false;
        if (category !== "All" && (fields["Discovery Category"] || fields.Niche) !== category) return false;
        if (!normalizedQuery) return true;
        return [fields.Name, fields["Display Name"], fields["TikTok Handle"], fields.Bio, fields["Discovery Source"]]
          .filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => (b.fields["Average Engagement Rate %"] || 0) - (a.fields["Average Engagement Rate %"] || 0));
  }, [category, contactFilter, creators, listFilter, maxDays, maxFollowers, minEngagement, minFollowers, query]);

  const todayCount = creators.filter((creator) => creator.fields["Date Contacted"] === austinDateStr()).length;

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">TikTok Creator Queue</h2>
          <p className="mt-1 font-mono text-sm text-muted">{filtered.length} ready now · {todayCount} contacted today · {creators.length} saved</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button onClick={() => setAdding((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-3 py-2.5 text-sm font-bold text-white sm:px-4"><Plus size={15} /> Save prospect</button>
          <button onClick={load} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface2 px-3 py-2.5 text-sm text-textSecondary sm:px-4"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-[rgba(232,67,10,0.4)] bg-[rgba(232,67,10,0.1)] px-4 py-3 text-sm text-accentLight">{error}</div>}

      {adding && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface2 p-5 sm:grid-cols-2">
          <input autoFocus value={newCreator["Display Name"] || ""} onChange={(event) => setNewCreator({ ...newCreator, "Display Name": event.target.value, Name: event.target.value })} placeholder="Display name" className={input} />
          <input value={newCreator["TikTok Handle"] || ""} onChange={(event) => setNewCreator({ ...newCreator, "TikTok Handle": event.target.value })} placeholder="@username" className={input} />
          <input value={newCreator["TikTok URL"] || ""} onChange={(event) => setNewCreator({ ...newCreator, "TikTok URL": event.target.value })} placeholder="TikTok profile URL" className={input} />
          <input value={newCreator["Discovery Category"] || ""} onChange={(event) => setNewCreator({ ...newCreator, "Discovery Category": event.target.value })} placeholder="Discovery category" className={input} />
          <button onClick={create} disabled={saving === "new"} className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{saving === "new" ? "Saving…" : "Save prospect"}</button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface2 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-black/20 px-3.5 py-2.5">
          <Search size={15} className="text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creator, handle, bio, or source" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted" />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted">
            Creator list
            <select value={listFilter} onChange={(event) => setListFilter(event.target.value)} className={`${input} mt-1`}>
              <option value="Primary">Primary — qualified</option>
              <option value="Reserve">Reserve — backup</option>
              <option value="All">All lists</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Outreach status
            <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value as ContactFilter)} className={`${input} mt-1`}>
              <option value="Not Contacted">Not contacted</option>
              <option value="Contacted">Contacted</option>
              <option value="All">All statuses</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Discovery category
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={`${input} mt-1`}>
              <option value="All">All categories</option>
              {categories.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Active within (days)<input type="number" value={maxDays} onChange={(event) => setMaxDays(Number(event.target.value) || 0)} className={`${input} mt-1`} /></label>
          <label className="text-xs text-muted">Min followers<input type="number" value={minFollowers} onChange={(event) => setMinFollowers(Number(event.target.value) || 0)} className={`${input} mt-1`} /></label>
          <label className="text-xs text-muted">Max followers<input type="number" value={maxFollowers} onChange={(event) => setMaxFollowers(Number(event.target.value) || 0)} className={`${input} mt-1`} /></label>
          <label className="text-xs text-muted">Min engagement %<input type="number" step="0.1" value={minEngagement} onChange={(event) => setMinEngagement(Number(event.target.value) || 0)} className={`${input} mt-1`} /></label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Primary creators meet the qualification targets. Reserve creators are still active and engaged but fall outside the primary follower range.
        </p>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="font-semibold text-foreground">No creators match this execution view.</p>
          <p className="mt-2 text-sm text-muted">Run the Bookworm TikTok research CLI or loosen a filter. The default is Qualified + Not Contacted.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((creator) => {
          const fields = creator.fields;
          const url = profileUrl(fields);
          return (
            <article key={creator.id} className="rounded-xl border border-border bg-surface2 p-4">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
                <button onClick={() => setSelected(creator)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-base font-bold text-foreground">{fields["Display Name"] || fields.Name || fields["TikTok Handle"]}</p>
                  <p className="mt-1 truncate text-sm text-muted">{fields["TikTok Handle"]} · {compact(fields.Followers)} followers · {fields["Average Engagement Rate %"]?.toFixed(2) || "—"}% engagement</p>
                  <p className="mt-2 line-clamp-2 text-sm text-textSecondary">{fields.Bio || "No bio available"}</p>
                </button>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  {url && <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1 rounded-full border border-border px-3 py-2 text-xs text-textSecondary hover:border-accent"><ExternalLink size={13} /> TikTok</a>}
                  <button onClick={() => patch(creator, { Status: "DM Sent", "Date Contacted": austinDateStr() })} disabled={saving === creator.id} className="flex min-h-10 items-center justify-center gap-1 rounded-full bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={13} /> Contacted</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted sm:flex sm:flex-wrap sm:text-xs">
                <span>{compact(fields["Average Views"])} avg views</span><span>{fields["Follower To Avg Views Ratio"]?.toFixed(3) || "—"} reach ratio</span><span>{fields["Days Since Last Post"] ?? "—"} days active</span><span>{fields.List || "Primary"}</span>
              </div>
            </article>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-surface2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold text-foreground">{selected.fields["Display Name"] || selected.fields.Name}</h3><p className="text-sm text-muted">{selected.fields["TikTok Handle"]}</p></div><button onClick={() => setSelected(null)}><X size={20} className="text-muted" /></button></div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={selected.fields.Status || "New"} onChange={(event) => setSelected({ ...selected, fields: { ...selected.fields, Status: event.target.value } })} className={input}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
              <select value={selected.fields.List || "Primary"} onChange={(event) => setSelected({ ...selected, fields: { ...selected.fields, List: event.target.value } })} className={input}><option>Primary</option><option>Reserve</option></select>
              <input type="date" value={selected.fields["Next Action Date"] || ""} onChange={(event) => setSelected({ ...selected, fields: { ...selected.fields, "Next Action Date": event.target.value } })} className={input} />
              <input value={selected.fields["Next Action"] || ""} onChange={(event) => setSelected({ ...selected, fields: { ...selected.fields, "Next Action": event.target.value } })} placeholder="Next action" className={input} />
            </div>
            <textarea value={selected.fields.Notes || ""} onChange={(event) => setSelected({ ...selected, fields: { ...selected.fields, Notes: event.target.value } })} placeholder="Notes" rows={3} className={`${input} mt-3 resize-none`} />
            <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row">
              <button onClick={async () => { const updated = await patch(selected, selected.fields); if (updated) setSelected(null); }} disabled={saving === selected.id} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white"><Save size={15} /> Save</button>
              <button onClick={async () => { const updated = await patch(selected, { Excluded: true }); if (updated) setSelected(null); }} disabled={saving === selected.id} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted hover:border-accent hover:text-white"><Ban size={15} /> Exclude</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
