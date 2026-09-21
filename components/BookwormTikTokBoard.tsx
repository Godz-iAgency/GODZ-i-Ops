"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import { Plus, X, RefreshCw, Save, ExternalLink, Search, ChevronDown, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import { TIKTOK_NICHES as NICHES, TIKTOK_DAILY_GOAL as DAILY_GOAL } from "@/lib/bookwormTikTok";

const PAGE_SIZE = 10;

const STATUSES = ["New", "DM Sent", "Replied", "In Talks", "Partnered", "Not Interested"];

type TikTokFields = {
  Name?: string;
  "TikTok Handle"?: string;
  "TikTok URL"?: string;
  Followers?: number;
  Niche?: string;
  Email?: string;
  "Date Contacted"?: string;
  Status?: string;
  Response?: string;
  Notes?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
};

type Creator = { id: string; fields: TikTokFields };

const emptyForm: TikTokFields = {
  Name: "",
  "TikTok Handle": "",
  "TikTok URL": "",
  Niche: "",
  Email: "",
  Status: "DM Sent",
  Notes: "",
};

const inputCls =
  "w-full text-base px-3.5 py-3 rounded-lg outline-none bg-black/30 border border-border text-foreground placeholder:text-muted";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm uppercase tracking-[0.14em] text-muted font-mono">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function pillStyle(active: boolean) {
  return {
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "#0a0705" : "var(--color-muted)",
    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
  };
}

// A handle typed with or without the @ should still open the right profile.
function profileLink(f: TikTokFields): string | null {
  if (f["TikTok URL"]) return f["TikTok URL"];
  const handle = (f["TikTok Handle"] || "").trim().replace(/^@/, "");
  return handle ? `https://www.tiktok.com/@${encodeURIComponent(handle)}` : null;
}

function formatFollowers(n?: number) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// Airtable rejects "" for a number field, so an empty box means "leave it off".
function cleanFields(f: TikTokFields): TikTokFields {
  const out: TikTokFields = { ...f };
  if (out.Followers == null || Number.isNaN(out.Followers)) delete out.Followers;
  return out;
}

export default function BookwormTikTokBoard() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<TikTokFields>(emptyForm);
  const [detail, setDetail] = useState<Creator | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Creator | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [nicheFilter, setNicheFilter] = useState<string>("All");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const today = austinDateStr();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookworm-tiktok");
      if (!res.ok) throw new Error("Failed to load TikTok creators");
      const data = await res.json();
      setCreators(data.creators);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.Name?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookworm-tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanFields({ ...form, "Date Contacted": form["Date Contacted"] || today })),
      });
      if (!res.ok) throw new Error("Failed to save creator");
      const created = await res.json();
      setCreators((prev) => [created, ...prev]);
      setForm(emptyForm);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookworm-tiktok/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanFields(detail.fields)),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setCreators((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bookworm-tiktok/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCreators((prev) => prev.filter((c) => c.id !== id));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setPendingDelete(null);
      setSaving(false);
    }
  };

  const setDetailField = (patch: TikTokFields) =>
    setDetail((d) => (d ? { ...d, fields: { ...d.fields, ...patch } } : d));

  const todayCount = useMemo(
    () => creators.filter((c) => c.fields["Date Contacted"] === today).length,
    [creators, today]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return creators.filter((c) => {
      if (statusFilter !== "All" && (c.fields.Status || "New") !== statusFilter) return false;
      if (nicheFilter !== "All" && (c.fields.Niche || "") !== nicheFilter) return false;
      if (!q) return true;
      return [c.fields.Name, c.fields["TikTok Handle"], c.fields.Niche]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [creators, query, statusFilter, nicheFilter]);

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;
  const detailLink = detail ? profileLink(detail.fields) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">TikTok creators</h2>
          <p className="text-sm text-muted font-mono mt-1">
            {creators.length} tracked · {todayCount}/{DAILY_GOAL} contacted today ·{" "}
            {creators.filter((c) => c.fields.Status === "Partnered").length} partnered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          >
            <Plus size={15} /> Add creator
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      {adding && (
        <div className="rounded-2xl p-5 bg-surface2 border border-border flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              autoFocus
              value={form.Name}
              onChange={(e) => setForm({ ...form, Name: e.target.value })}
              placeholder="Creator name"
              className={inputCls}
            />
            <input
              value={form["TikTok Handle"]}
              onChange={(e) => setForm({ ...form, "TikTok Handle": e.target.value })}
              placeholder="@handle"
              className={inputCls}
            />
            <select
              value={form.Niche}
              onChange={(e) => setForm({ ...form, Niche: e.target.value })}
              className={inputCls}
            >
              <option value="">Niche…</option>
              {NICHES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={form.Followers ?? ""}
              onChange={(e) =>
                setForm({ ...form, Followers: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              placeholder="Followers"
              className={inputCls}
            />
            <select
              value={form.Status}
              onChange={(e) => setForm({ ...form, Status: e.target.value })}
              className={inputCls}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={form.Email}
              onChange={(e) => setForm({ ...form, Email: e.target.value })}
              placeholder="Business email (if listed)"
              className={inputCls}
            />
          </div>
          <input
            value={form["TikTok URL"]}
            onChange={(e) => setForm({ ...form, "TikTok URL": e.target.value })}
            placeholder="Profile URL (optional)"
            className={inputCls}
          />
          <textarea
            value={form.Notes}
            onChange={(e) => setForm({ ...form, Notes: e.target.value })}
            placeholder="Notes"
            rows={2}
            className={inputCls + " resize-none"}
          />
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={saving}
              className="flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
            >
              <Save size={14} /> {saving ? "Saving…" : "Save creator"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setForm(emptyForm);
              }}
              className="px-4 py-3 rounded-lg bg-surface3"
            >
              <X size={15} color="var(--color-muted)" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 flex-wrap items-center">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface2 border border-border flex-1 min-w-[200px]">
          <Search size={15} color="var(--color-muted)" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Name, handle, niche…"
            className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
          />
        </div>
        <select
          value={nicheFilter}
          onChange={(e) => {
            setNicheFilter(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="text-sm px-4 py-3 rounded-full outline-none bg-surface2 border border-border text-textSecondary"
        >
          <option value="All">All niches</option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto bg-surface2 p-1.5 rounded-full border border-border">
          {["All", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setVisible(PAGE_SIZE);
              }}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={pillStyle(statusFilter === s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {!loading && filtered.length === 0 && (
          <p className="text-base italic text-muted px-1 py-6 text-center">
            {creators.length === 0
              ? "No creators yet. Search TikTok using the terms on the Search tab, then add who you reach out to."
              : "No matches."}
          </p>
        )}
        {shown.map((c) => {
          const f = c.fields;
          const followers = formatFollowers(f.Followers);
          return (
            <div
              key={c.id}
              onClick={() => setDetail(c)}
              className="card-hover rounded-xl p-4 flex items-center gap-3 cursor-pointer bg-surface2 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate text-foreground">{f.Name}</p>
                <p className="text-sm text-muted truncate">
                  {[f["TikTok Handle"], f.Niche, followers && `${followers} followers`].filter(Boolean).join(" · ") ||
                    "No handle yet"}
                </p>
                {f["Next Action"] && (
                  <p className="text-xs text-accentLight truncate mt-1">→ {f["Next Action"]}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceElevated text-textSecondary">
                  {f.Status || "New"}
                </span>
                {f["Date Contacted"] && (
                  <span className="text-xs text-muted font-mono">{f["Date Contacted"]}</span>
                )}
              </div>
            </div>
          );
        })}
        {remaining > 0 && (
          <button
            onClick={() => setVisible(filtered.length)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-1.5 text-sm text-textSecondary bg-surface2 border border-border transition-all hover:border-accent hover:text-accentLight"
          >
            <ChevronDown size={15} /> Show {remaining} more
          </button>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-surface2 border border-border max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <input
                value={detail.fields.Name || ""}
                onChange={(e) => setDetailField({ Name: e.target.value })}
                className="text-2xl font-bold bg-transparent outline-none flex-1 min-w-0 text-foreground"
              />
              <button onClick={() => setDetail(null)} className="mt-1">
                <X size={20} color="var(--color-muted)" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-border overflow-x-auto">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDetailField({ Status: s })}
                    className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={pillStyle((detail.fields.Status || "New") === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="TikTok handle">
                  <input
                    value={detail.fields["TikTok Handle"] || ""}
                    onChange={(e) => setDetailField({ "TikTok Handle": e.target.value })}
                    placeholder="@handle"
                    className={inputCls}
                  />
                </Field>
                <Field label="Followers">
                  <input
                    type="number"
                    min={0}
                    value={detail.fields.Followers ?? ""}
                    onChange={(e) =>
                      setDetailField({ Followers: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Niche">
                <select
                  value={detail.fields.Niche || ""}
                  onChange={(e) => setDetailField({ Niche: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Not set</option>
                  {NICHES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Profile URL">
                <input
                  value={detail.fields["TikTok URL"] || ""}
                  onChange={(e) => setDetailField({ "TikTok URL": e.target.value })}
                  placeholder="https://www.tiktok.com/@…"
                  className={inputCls}
                />
              </Field>
              {detailLink && (
                <a
                  href={detailLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-3 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all -mt-1"
                >
                  <ExternalLink size={14} /> Open on TikTok
                </a>
              )}

              <Field label="Business email">
                <input
                  value={detail.fields.Email || ""}
                  onChange={(e) => setDetailField({ Email: e.target.value })}
                  placeholder="Only if it's listed on their profile"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date contacted">
                  <input
                    type="date"
                    value={detail.fields["Date Contacted"] || ""}
                    onChange={(e) => setDetailField({ "Date Contacted": e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Next action date">
                  <input
                    type="date"
                    value={detail.fields["Next Action Date"] || ""}
                    onChange={(e) => setDetailField({ "Next Action Date": e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Next action">
                <input
                  value={detail.fields["Next Action"] || ""}
                  onChange={(e) => setDetailField({ "Next Action": e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Their response">
                <textarea
                  value={detail.fields.Response || ""}
                  onChange={(e) => setDetailField({ Response: e.target.value })}
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={detail.fields.Notes || ""}
                  onChange={(e) => setDetailField({ Notes: e.target.value })}
                  rows={3}
                  className={inputCls + " resize-none"}
                />
              </Field>

              <button
                onClick={saveDetail}
                disabled={saving}
                className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                  boxShadow: "var(--shadow-cta)",
                }}
              >
                <Save size={17} /> {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => setPendingDelete(detail)}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-muted border border-border hover:text-accentLight hover:border-accent transition-all disabled:opacity-50"
              >
                <Trash2 size={15} /> Delete creator
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDeleteDialog
          name={pendingDelete.fields.Name || ""}
          busy={saving}
          onConfirm={() => remove(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
