"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, RefreshCw, Save, Mail, Phone, MapPin, ArrowRight } from "lucide-react";

type Tier = "godzi" | "splitmic" | "gbombs" | "bookworm" | "hotcake";

const TIER_META: Record<Tier, { label: string; color: string }> = {
  godzi: { label: "GODZ-i", color: "#f2c94c" },
  splitmic: { label: "SplitMic", color: "#56ccf2" },
  gbombs: { label: "gBOMBS", color: "#ef6c9e" },
  bookworm: { label: "Bookworm", color: "#c9a66b" },
  hotcake: { label: "HotCake", color: "#5fbf7a" },
};
const TIER_ORDER: Tier[] = ["godzi", "splitmic", "gbombs", "bookworm", "hotcake"];

type LeadFields = {
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
type Lead = { id: string; fields: LeadFields };
type Schema = { category: string[]; channel: string[]; stage: string[] };

const emptyForm: LeadFields = {
  Name: "",
  Category: "",
  Channel: [],
  "Channel Handle": "",
  Email: "",
  Phone: "",
  Address: "",
  "Next Action": "",
  Notes: "",
};

// Defensive against transitional Airtable states where a field that will
// become a multi-select array is still its old single-value string form.
function asArray(v: string[] | string | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

function daysAgo(dateStr?: string) {
  if (!dateStr) return null;
  const d = Math.round((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function pillStyle(active: boolean, activeBg = "var(--color-accent)") {
  return {
    background: active ? activeBg : "transparent",
    color: active ? "#0a0705" : "var(--color-muted)",
    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
  };
}

export default function OutreachBoard() {
  const [tier, setTier] = useState<Tier>("godzi");
  const [schema, setSchema] = useState<Schema | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [form, setForm] = useState<LeadFields>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);

  const load = useCallback(async (t: Tier) => {
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, leadsRes] = await Promise.all([
        fetch(`/api/schema?tier=${t}`),
        fetch(`/api/leads?tier=${t}`),
      ]);
      if (!schemaRes.ok || !leadsRes.ok) throw new Error("Failed to load from Airtable");
      const schemaData = await schemaRes.json();
      const leadsData = await leadsRes.json();
      setSchema(schemaData);
      setLeads(leadsData.leads);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tier);
  }, [tier, load]);

  const moveStage = async (id: string, stage: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, fields: { ...l.fields, Stage: stage } } : l)));
    try {
      await fetch(`/api/leads/${id}?tier=${tier}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Stage: stage }),
      });
    } catch {
      load(tier);
    }
  };

  const createLead = async (stage: string) => {
    if (!form.Name?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads?tier=${tier}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, Stage: stage }),
      });
      if (!res.ok) throw new Error("Failed to save lead");
      const created = await res.json();
      setLeads((prev) => [...prev, created]);
      setForm(emptyForm);
      setAddingStage(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${detail.id}?tier=${tier}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail.fields),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setDetail(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (target: LeadFields, ch: string, setter: (f: LeadFields) => void) => {
    const current = asArray(target.Channel);
    const next = current.includes(ch) ? current.filter((c) => c !== ch) : [...current, ch];
    setter({ ...target, Channel: next });
  };

  const stages = schema?.stage?.length ? schema.stage : ["New", "Contacted", "Replied", "Engaged", "Won", "Lost"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 overflow-x-auto bg-surface2 p-1 rounded-full border border-border max-w-full">
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
              style={pillStyle(tier === t, TIER_META[t].color)}
            >
              {TIER_META[t].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(tier)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl text-sm bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      <div className="flex gap-3.5 overflow-x-auto pb-3 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.fields.Stage === stage);
          const isOver = overStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) moveStage(dragId, stage);
                setOverStage(null);
                setDragId(null);
              }}
              className="flex-shrink-0 snap-start rounded-2xl flex flex-col bg-surface2 border"
              style={{
                width: "min(85vw, 250px)",
                minHeight: "60vh",
                borderColor: isOver ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <div className="px-3.5 py-3 flex items-center justify-between border-b border-border">
                <h3 className="text-[13px] font-bold text-foreground">{stage}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface3 text-muted font-mono">
                  {stageLeads.length}
                </span>
              </div>
              <div className="p-2.5 flex flex-col gap-2 flex-1">
                {stageLeads.length === 0 && addingStage !== stage && (
                  <p className="text-xs italic px-1 py-3 text-muted">No one here yet.</p>
                )}
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    className="card-hover rounded-xl p-3 flex flex-col gap-2 cursor-pointer bg-surface3 border border-border"
                    style={{ opacity: dragId === lead.id ? 0.4 : 1 }}
                  >
                    <div onClick={() => setDetail(lead)} className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate flex-1 text-foreground">{lead.fields.Name}</span>
                      {lead.fields["Last Contact"] && (
                        <span className="text-[10px] text-muted font-mono flex-shrink-0">
                          {daysAgo(lead.fields["Last Contact"])}
                        </span>
                      )}
                    </div>
                    <div onClick={() => setDetail(lead)} className="flex items-center gap-1.5 flex-wrap">
                      {lead.fields.Category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surfaceElevated text-textSecondary">
                          {lead.fields.Category}
                        </span>
                      )}
                      {asArray(lead.fields.Channel).map((c) => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-surfaceElevated text-accentLight">
                          {c}
                        </span>
                      ))}
                    </div>
                    {/* Touch-friendly stage move -- drag-and-drop needs a mouse, this works on tablet */}
                    <select
                      value={stage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => moveStage(lead.id, e.target.value)}
                      className="text-[11px] px-2 py-1.5 rounded-lg outline-none bg-black/30 border border-border text-textSecondary font-mono"
                    >
                      {stages.map((s) => (
                        <option key={s} value={s}>
                          Move to: {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="p-2.5 border-t border-border">
                {addingStage === stage ? (
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface3 border border-border">
                    <input
                      autoFocus
                      value={form.Name}
                      onChange={(e) => setForm({ ...form, Name: e.target.value })}
                      placeholder="Name"
                      className="text-[13px] px-2.5 py-2 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    {schema?.category && schema.category.length > 0 && (
                      <select
                        value={form.Category}
                        onChange={(e) => setForm({ ...form, Category: e.target.value })}
                        className="text-[13px] px-2.5 py-2 rounded-lg outline-none bg-black/40 border border-border text-foreground"
                      >
                        <option value="">Category...</option>
                        {schema.category.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {(schema?.channel || []).map((c) => {
                        const active = (form.Channel || []).includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleChannel(form, c, setForm)}
                            className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                            style={{
                              background: active ? "var(--color-accent)" : "transparent",
                              borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                              color: active ? "#fff" : "var(--color-muted)",
                            }}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={form.Email}
                      onChange={(e) => setForm({ ...form, Email: e.target.value })}
                      placeholder="Email"
                      className="text-[13px] px-2.5 py-2 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Phone}
                      onChange={(e) => setForm({ ...form, Phone: e.target.value })}
                      placeholder="Phone"
                      className="text-[13px] px-2.5 py-2 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => createLead(stage)}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setAddingStage(null);
                          setForm(emptyForm);
                        }}
                        className="px-2.5 py-2 rounded-lg bg-surface2"
                      >
                        <X size={13} color="var(--color-muted)" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingStage(stage)}
                    className="w-full py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs text-muted border border-dashed border-borderHover transition-all hover:border-accent hover:text-accentLight"
                  >
                    <Plus size={13} /> Add lead
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detail && schema && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 bg-surface2 border border-border max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <input
                value={detail.fields.Name || ""}
                onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Name: e.target.value } })}
                className="text-xl font-bold bg-transparent outline-none flex-1 text-foreground"
              />
              <button onClick={() => setDetail(null)}>
                <X size={18} color="var(--color-muted)" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 p-1 rounded-xl bg-black/30 border border-border overflow-x-auto">
                {stages.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDetail({ ...detail, fields: { ...detail.fields, Stage: s } })}
                    className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={pillStyle(detail.fields.Stage === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.14em] text-muted font-mono">Category</label>
                <select
                  value={detail.fields.Category || ""}
                  onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Category: e.target.value } })}
                  className="w-full mt-1 text-[13px] px-2.5 py-2 rounded-lg outline-none bg-black/30 border border-border text-foreground"
                >
                  <option value="">None</option>
                  {schema.category.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.14em] text-muted font-mono">Channels</label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {schema.channel.map((c) => {
                    const active = asArray(detail.fields.Channel).includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() =>
                          toggleChannel(detail.fields, c, (f) => setDetail({ ...detail, fields: f }))
                        }
                        className="text-xs px-3 py-1.5 rounded-full border transition-all"
                        style={{
                          background: active ? "var(--color-accent)" : "transparent",
                          borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                          color: active ? "#fff" : "var(--color-muted)",
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 px-2.5 py-2.5 rounded-lg bg-black/30 border border-border">
                  <Mail size={14} color="var(--color-muted)" />
                  <input
                    value={detail.fields.Email || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Email: e.target.value } })}
                    placeholder="Email"
                    className="flex-1 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted"
                  />
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2.5 rounded-lg bg-black/30 border border-border">
                  <Phone size={14} color="var(--color-muted)" />
                  <input
                    value={detail.fields.Phone || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Phone: e.target.value } })}
                    placeholder="Phone"
                    className="flex-1 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted"
                  />
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2.5 rounded-lg bg-black/30 border border-border">
                  <MapPin size={14} color="var(--color-muted)" />
                  <input
                    value={detail.fields.Address || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Address: e.target.value } })}
                    placeholder="Address"
                    className="flex-1 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted"
                  />
                </div>
                <input
                  value={detail.fields["Channel Handle"] || ""}
                  onChange={(e) =>
                    setDetail({ ...detail, fields: { ...detail.fields, "Channel Handle": e.target.value } })
                  }
                  placeholder="Handle / profile link"
                  className="text-[13px] px-2.5 py-2.5 rounded-lg outline-none bg-black/30 border border-border text-foreground placeholder:text-muted"
                />
              </div>

              <input
                value={detail.fields["Next Action"] || ""}
                onChange={(e) =>
                  setDetail({ ...detail, fields: { ...detail.fields, "Next Action": e.target.value } })
                }
                placeholder="Next action"
                className="text-[13px] px-2.5 py-2.5 rounded-lg outline-none bg-black/30 border border-border text-foreground placeholder:text-muted"
              />
              <textarea
                value={detail.fields.Notes || ""}
                onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Notes: e.target.value } })}
                placeholder="Notes"
                rows={3}
                className="text-[13px] px-2.5 py-2.5 rounded-lg outline-none resize-none bg-black/30 border border-border text-foreground placeholder:text-muted"
              />

              {detail.fields["Last Contact"] && (
                <p className="text-xs text-muted font-mono">
                  Last contact: {detail.fields["Last Contact"]} ({daysAgo(detail.fields["Last Contact"])})
                </p>
              )}

              <button
                onClick={saveDetail}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                  boxShadow: "var(--shadow-cta)",
                }}
              >
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
