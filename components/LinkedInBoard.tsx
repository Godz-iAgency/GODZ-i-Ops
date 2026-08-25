"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import { Plus, X, RefreshCw, Save, ExternalLink, Search, ChevronDown, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

const STATUSES = ["New", "Contacted", "Connected", "Replied", "Engaged", "Follow-up", "Meeting"];

type LinkedInFields = {
  Name?: string;
  Organization?: string;
  Role?: string;
  "LinkedIn URL"?: string;
  "Date Contacted"?: string;
  Status?: string;
  Response?: string;
  Notes?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
};

type Prospect = { id: string; fields: LinkedInFields };

const emptyForm: LinkedInFields = {
  Name: "",
  Organization: "",
  Role: "",
  "LinkedIn URL": "",
  Status: "Contacted",
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

export default function LinkedInBoard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<LinkedInFields>(emptyForm);
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const today = austinDateStr();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin");
      if (!res.ok) throw new Error("Failed to load LinkedIn prospects");
      const data = await res.json();
      setProspects(data.prospects);
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
      const res = await fetch("/api/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, "Date Contacted": form["Date Contacted"] || today }),
      });
      if (!res.ok) throw new Error("Failed to save prospect");
      const created = await res.json();
      setProspects((prev) => [created, ...prev]);
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
      const res = await fetch(`/api/linkedin/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail.fields),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
      const res = await fetch(`/api/linkedin/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProspects((prev) => prev.filter((p) => p.id !== id));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const setDetailField = (patch: LinkedInFields) =>
    setDetail((d) => (d ? { ...d, fields: { ...d.fields, ...patch } } : d));

  const todayCount = useMemo(
    () => prospects.filter((p) => p.fields["Date Contacted"] === today).length,
    [prospects, today]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter !== "All" && (p.fields.Status || "New") !== statusFilter) return false;
      if (!q) return true;
      return [p.fields.Name, p.fields.Organization, p.fields.Role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [prospects, query, statusFilter]);

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">LinkedIn</h2>
          <p className="text-sm text-muted font-mono mt-1">
            {prospects.length} tracked · {todayCount}/10 added today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          >
            <Plus size={15} /> Add prospect
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
              placeholder="Name"
              className={inputCls}
            />
            <input
              value={form.Organization}
              onChange={(e) => setForm({ ...form, Organization: e.target.value })}
              placeholder="Organization"
              className={inputCls}
            />
            <input
              value={form.Role}
              onChange={(e) => setForm({ ...form, Role: e.target.value })}
              placeholder="Role"
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
          </div>
          <input
            value={form["LinkedIn URL"]}
            onChange={(e) => setForm({ ...form, "LinkedIn URL": e.target.value })}
            placeholder="LinkedIn URL"
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
              <Save size={14} /> {saving ? "Saving…" : "Save prospect"}
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
            placeholder="Name, org, role…"
            className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
          />
        </div>
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
            {prospects.length === 0
              ? "No prospects yet. Search LinkedIn using the terms on the Search tab, then add who you reach out to."
              : "No matches."}
          </p>
        )}
        {shown.map((p) => {
          const f = p.fields;
          return (
            <div
              key={p.id}
              onClick={() => setDetail(p)}
              className="card-hover rounded-xl p-4 flex items-center gap-3 cursor-pointer bg-surface2 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate text-foreground">{f.Name}</p>
                <p className="text-sm text-muted truncate">
                  {[f.Role, f.Organization].filter(Boolean).join(" · ") || "No organization"}
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
                <Field label="Organization">
                  <input
                    value={detail.fields.Organization || ""}
                    onChange={(e) => setDetailField({ Organization: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={detail.fields.Role || ""}
                    onChange={(e) => setDetailField({ Role: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="LinkedIn URL">
                <input
                  value={detail.fields["LinkedIn URL"] || ""}
                  onChange={(e) => setDetailField({ "LinkedIn URL": e.target.value })}
                  className={inputCls}
                />
              </Field>
              {detail.fields["LinkedIn URL"] && (
                <a
                  href={detail.fields["LinkedIn URL"]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                >
                  <ExternalLink size={14} /> Open profile
                </a>
              )}

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
              <Field label="Response">
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
                onClick={() => remove(detail.id)}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-muted border border-border hover:text-accentLight hover:border-accent transition-all disabled:opacity-50"
              >
                <Trash2 size={15} /> Delete prospect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
