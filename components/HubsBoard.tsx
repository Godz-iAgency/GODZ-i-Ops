"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import {
  RefreshCw,
  Search,
  Phone,
  Mail,
  Globe,
  X,
  Save,
  Check,
  Copy,
  Zap,
  ExternalLink,
} from "lucide-react";

const STATUSES = ["Not Contacted", "Called", "Connected", "Follow Up", "Partnership", "Not Relevant"];

const FILTERS = [
  "All",
  "Musicians",
  "Venues",
  "Music Organizations",
  "Music Schools",
  "Media",
  "Government / Music Ecosystem",
  "Performing Arts",
  "Other",
];

// The CSV's raw categories are more granular than the filter list, so they get
// folded into buckets here rather than rewritten in Airtable. The source
// category stays intact on every record.
function filterGroup(category?: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("government") || c.includes("funding")) return "Government / Music Ecosystem";
  if (c.includes("school") || c.includes("education")) return "Music Schools";
  if (c.includes("media")) return "Media";
  if (c.includes("venue")) return "Venues";
  if (c.includes("performing arts")) return "Performing Arts";
  if (c.includes("musician")) return "Musicians";
  if (c.includes("music")) return "Music Organizations";
  return "Other";
}

type HubFields = {
  Name?: string;
  Category?: string;
  "Who They Reach"?: string;
  Phone?: string;
  Email?: string;
  Website?: string;
  "Why Call"?: string;
  Status?: string;
  "Last Contacted"?: string;
  Notes?: string;
};

type Hub = { id: string; fields: HubFields };

const inputCls =
  "w-full text-base px-3.5 py-3 rounded-lg outline-none bg-black/30 border border-border text-foreground placeholder:text-muted";

function pillStyle(active: boolean) {
  return {
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "#0a0705" : "var(--color-muted)",
    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
  };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => {}
        );
      }}
      aria-label={`Copy ${label}`}
      className="p-2 rounded-lg hover:bg-white/[0.06] transition-all flex-shrink-0"
    >
      {copied ? <Check size={14} color="var(--color-accent)" /> : <Copy size={14} color="var(--color-muted)" />}
    </button>
  );
}

export default function HubsBoard() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState<Hub | null>(null);
  const [pick, setPick] = useState<Hub | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hubs");
      if (!res.ok) throw new Error("Could not load Austin Music Hubs");
      const data = await res.json();
      setHubs(data.hubs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hubs/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Status: detail.fields.Status,
          "Last Contacted": detail.fields["Last Contacted"] || null,
          Notes: detail.fields.Notes || "",
        }),
      });
      if (!res.ok) throw new Error("Could not save");
      const updated = await res.json();
      setHubs((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const setDetailField = (patch: HubFields) =>
    setDetail((d) => (d ? { ...d, fields: { ...d.fields, ...patch } } : d));

  // Spare-time mode: one uncontacted org with a real phone number, no choosing.
  const findOneToCall = () => {
    const callable = hubs.filter(
      (h) => (h.fields.Status || "Not Contacted") === "Not Contacted" && (h.fields.Phone || "").trim()
    );
    if (callable.length === 0) {
      setPick(null);
      setError("No uncontacted organizations with a phone number left.");
      return;
    }
    setError(null);
    setPick(callable[Math.floor(Math.random() * callable.length)]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hubs.filter((h) => {
      if (filter !== "All" && filterGroup(h.fields.Category) !== filter) return false;
      if (!q) return true;
      return (h.fields.Name || "").toLowerCase().includes(q);
    });
  }, [hubs, query, filter]);

  const uncontacted = hubs.filter((h) => (h.fields.Status || "Not Contacted") === "Not Contacted").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Austin Music Hubs</h2>
        <p className="text-base text-muted mt-1">
          High-leverage Austin music organizations to contact when I have spare time.
        </p>
        <p className="text-sm text-muted font-mono mt-1.5">
          {hubs.length} organizations · {uncontacted} not contacted
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={findOneToCall}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold text-white transition-all hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            boxShadow: "var(--shadow-cta)",
          }}
        >
          <Zap size={17} /> Find one to call
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      {pick && (
        <div
          className="rounded-2xl p-5 border"
          style={{ background: "rgba(232,67,10,0.1)", borderColor: "rgba(232,67,10,0.45)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-1.5">
                Call this one
              </p>
              <h3 className="text-xl font-bold text-foreground">{pick.fields.Name}</h3>
            </div>
            <button onClick={() => setPick(null)}>
              <X size={18} color="var(--color-muted)" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {pick.fields["Who They Reach"] && (
              <p className="text-base text-textSecondary">{pick.fields["Who They Reach"]}</p>
            )}
            {pick.fields["Why Call"] && (
              <p className="text-sm text-muted">Why: {pick.fields["Why Call"]}</p>
            )}
            {pick.fields.Phone && (
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={`tel:${pick.fields.Phone.replace(/[^0-9+]/g, "")}`}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-lg font-bold text-white flex-1"
                  style={{ background: "var(--color-accent)" }}
                >
                  <Phone size={18} /> {pick.fields.Phone}
                </a>
                <CopyButton text={pick.fields.Phone} label="phone" />
              </div>
            )}
            <button
              onClick={() => {
                setDetail(pick);
                setPick(null);
              }}
              className="text-sm text-accentLight underline self-start mt-1"
            >
              Log the outcome
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface2 border border-border">
        <Search size={15} color="var(--color-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by organization name…"
          className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto bg-surface2 p-1.5 rounded-full border border-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={pillStyle(filter === f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {loading && <p className="text-base italic text-muted px-1">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-base italic text-muted px-1 py-6 text-center">No organizations match.</p>
        )}
        {filtered.map((h) => {
          const f = h.fields;
          const status = f.Status || "Not Contacted";
          const done = status !== "Not Contacted";
          return (
            <div
              key={h.id}
              className="rounded-xl p-4 bg-surface2 border flex flex-col gap-3"
              style={{ borderColor: done ? "rgba(232,67,10,0.3)" : "var(--color-border)" }}
            >
              <div
                onClick={() => setDetail(h)}
                className="flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">{f.Name}</p>
                  <p className="text-sm text-muted mt-0.5">{f.Category}</p>
                  {f["Who They Reach"] && (
                    <p className="text-sm text-textSecondary mt-1.5">{f["Who They Reach"]}</p>
                  )}
                  {f["Why Call"] && <p className="text-xs text-muted mt-1">Why: {f["Why Call"]}</p>}
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: done ? "rgba(232,67,10,0.18)" : "var(--color-surface-elevated)",
                    color: done ? "var(--color-accent-light)" : "var(--color-muted)",
                  }}
                >
                  {status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {f.Phone ? (
                  <div className="flex items-center gap-0.5 rounded-lg bg-black/30 border border-border pl-3">
                    <a
                      href={`tel:${f.Phone.replace(/[^0-9+]/g, "")}`}
                      className="flex items-center gap-2 py-2 text-sm text-foreground"
                    >
                      <Phone size={13} color="var(--color-accent)" /> {f.Phone}
                    </a>
                    <CopyButton text={f.Phone} label="phone" />
                  </div>
                ) : (
                  <span className="text-xs text-muted px-2.5 py-2 rounded-lg bg-black/20 border border-border">
                    No phone on file
                  </span>
                )}

                {f.Email && (
                  <div className="flex items-center gap-0.5 rounded-lg bg-black/30 border border-border pl-3">
                    <a
                      href={`mailto:${f.Email}`}
                      className="flex items-center gap-2 py-2 text-sm text-textSecondary"
                    >
                      <Mail size={13} /> {f.Email}
                    </a>
                    <CopyButton text={f.Email} label="email" />
                  </div>
                )}

                {f.Website && (
                  <a
                    href={f.Website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                  >
                    <Globe size={13} /> Website <ExternalLink size={11} />
                  </a>
                )}

                <button
                  onClick={() => setDetail(h)}
                  className="ml-auto text-sm px-3.5 py-2 rounded-lg text-textSecondary border border-border hover:border-accent hover:text-accentLight transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-surface2 border border-border max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-xl font-bold text-foreground">{detail.fields.Name}</h3>
              <button onClick={() => setDetail(null)} className="mt-1">
                <X size={20} color="var(--color-muted)" />
              </button>
            </div>
            <p className="text-sm text-muted mb-5">{detail.fields.Category}</p>

            <div className="flex flex-col gap-4">
              {detail.fields.Phone && (
                <a
                  href={`tel:${detail.fields.Phone.replace(/[^0-9+]/g, "")}`}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-lg font-bold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  <Phone size={18} /> {detail.fields.Phone}
                </a>
              )}

              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted font-mono">Status</label>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setDetailField({
                          Status: s,
                          "Last Contacted":
                            s !== "Not Contacted" && !detail.fields["Last Contacted"]
                              ? austinDateStr()
                              : detail.fields["Last Contacted"],
                        })
                      }
                      className="px-3.5 py-2 rounded-full text-sm font-semibold border transition-all"
                      style={{
                        background: (detail.fields.Status || "Not Contacted") === s ? "var(--color-accent)" : "transparent",
                        borderColor:
                          (detail.fields.Status || "Not Contacted") === s
                            ? "var(--color-accent)"
                            : "var(--color-border)",
                        color: (detail.fields.Status || "Not Contacted") === s ? "#fff" : "var(--color-muted)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted font-mono">
                  Last contacted
                </label>
                <input
                  type="date"
                  value={detail.fields["Last Contacted"] || ""}
                  onChange={(e) => setDetailField({ "Last Contacted": e.target.value })}
                  className={inputCls + " mt-1.5"}
                />
              </div>

              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted font-mono">Notes</label>
                <textarea
                  value={detail.fields.Notes || ""}
                  onChange={(e) => setDetailField({ Notes: e.target.value })}
                  rows={4}
                  placeholder="Who did you speak to? What came out of it?"
                  className={inputCls + " resize-none mt-1.5"}
                />
              </div>

              <button
                onClick={saveDetail}
                disabled={saving}
                className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                  boxShadow: "var(--shadow-cta)",
                }}
              >
                <Save size={17} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
