"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, RefreshCw, Save, Trash2, Mail, Phone, MapPin } from "lucide-react";

type Tier = "godzi" | "splitmic" | "gbombs" | "bookworm" | "hotcake";

const TIER_META: Record<Tier, { label: string; color: string }> = {
  godzi: { label: "GODZ-i", color: "#F2C94C" },
  splitmic: { label: "SplitMic", color: "#56CCF2" },
  gbombs: { label: "gBOMBS", color: "#EF6C9E" },
  bookworm: { label: "Bookworm", color: "#C9A66B" },
  hotcake: { label: "HotCake", color: "#5FBF7A" },
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
        <div className="flex gap-2 flex-wrap">
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border"
              style={{
                background: tier === t ? TIER_META[t].color : "#141414",
                color: tier === t ? "#000" : "#999",
                borderColor: tier === t ? TIER_META[t].color : "#2C2C2C",
              }}
            >
              {TIER_META[t].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(tier)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-[#2C2C2C] bg-[#141414] text-[#999] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-[rgba(240,69,31,0.14)] border border-[#F0451F] text-[#F0451F]">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
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
              className="flex-shrink-0 w-64 rounded-xl flex flex-col bg-[#141414] border"
              style={{ borderColor: isOver ? "#F0451F" : "#2C2C2C", minHeight: "60vh" }}
            >
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#2C2C2C]">
                <h3 className="text-sm font-semibold font-heading">{stage}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1F1F1F] text-[#999] font-mono">
                  {stageLeads.length}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-2 flex-1">
                {stageLeads.length === 0 && addingStage !== stage && (
                  <p className="text-xs italic px-1 py-3 text-[#999]">No one here yet.</p>
                )}
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setDetail(lead)}
                    className="card-hover rounded-lg p-2.5 flex flex-col gap-1.5 cursor-pointer bg-[#1F1F1F] border border-[#2C2C2C]"
                    style={{ opacity: dragId === lead.id ? 0.4 : 1 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate flex-1">{lead.fields.Name}</span>
                      {lead.fields["Last Contact"] && (
                        <span className="text-[10px] text-[#999] font-mono flex-shrink-0">
                          {daysAgo(lead.fields["Last Contact"])}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {lead.fields.Category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#141414] text-[#999]">
                          {lead.fields.Category}
                        </span>
                      )}
                      {asArray(lead.fields.Channel).map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#141414] text-[#4FD1C5]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-[#2C2C2C]">
                {addingStage === stage ? (
                  <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-[#1F1F1F] border border-[#2C2C2C]">
                    <input
                      autoFocus
                      value={form.Name}
                      onChange={(e) => setForm({ ...form, Name: e.target.value })}
                      placeholder="Name"
                      className="text-sm px-2 py-1.5 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
                    />
                    {schema?.category && schema.category.length > 0 && (
                      <select
                        value={form.Category}
                        onChange={(e) => setForm({ ...form, Category: e.target.value })}
                        className="text-sm px-2 py-1.5 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
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
                            className="text-[10px] px-2 py-1 rounded-full border"
                            style={{
                              background: active ? "#F0451F" : "transparent",
                              borderColor: active ? "#F0451F" : "#2C2C2C",
                              color: active ? "#fff" : "#999",
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
                      className="text-sm px-2 py-1.5 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
                    />
                    <input
                      value={form.Phone}
                      onChange={(e) => setForm({ ...form, Phone: e.target.value })}
                      placeholder="Phone"
                      className="text-sm px-2 py-1.5 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
                    />
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => createLead(stage)}
                        disabled={saving}
                        className="flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 bg-[#F0451F] text-white disabled:opacity-50"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setAddingStage(null);
                          setForm(emptyForm);
                        }}
                        className="px-2 py-1.5 rounded-md bg-[#141414]"
                      >
                        <X size={13} color="#999" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingStage(stage)}
                    className="w-full py-1.5 rounded-md flex items-center justify-center gap-1.5 text-xs text-[#999] border border-dashed border-[#2C2C2C]"
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
          className="fixed inset-0 flex items-center justify-center p-5 z-50 bg-black/70"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-xl p-5 bg-[#141414] border border-[#2C2C2C] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <input
                value={detail.fields.Name || ""}
                onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Name: e.target.value } })}
                className="text-xl font-heading bg-transparent outline-none flex-1"
              />
              <button onClick={() => setDetail(null)}>
                <X size={18} color="#999" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-[#999] font-mono">Stage</label>
                <select
                  value={detail.fields.Stage || ""}
                  onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Stage: e.target.value } })}
                  className="w-full mt-1 text-sm px-2.5 py-2 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-[#999] font-mono">Category</label>
                <select
                  value={detail.fields.Category || ""}
                  onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Category: e.target.value } })}
                  className="w-full mt-1 text-sm px-2.5 py-2 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
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
                <label className="text-xs uppercase tracking-wide text-[#999] font-mono">Channels</label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {schema.channel.map((c) => {
                    const active = asArray(detail.fields.Channel).includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() =>
                          toggleChannel(detail.fields, c, (f) => setDetail({ ...detail, fields: f }))
                        }
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{
                          background: active ? "#F0451F" : "transparent",
                          borderColor: active ? "#F0451F" : "#2C2C2C",
                          color: active ? "#fff" : "#999",
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-black border border-[#2C2C2C]">
                  <Mail size={14} color="#999" />
                  <input
                    value={detail.fields.Email || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Email: e.target.value } })}
                    placeholder="Email"
                    className="flex-1 text-sm bg-transparent outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-black border border-[#2C2C2C]">
                  <Phone size={14} color="#999" />
                  <input
                    value={detail.fields.Phone || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Phone: e.target.value } })}
                    placeholder="Phone"
                    className="flex-1 text-sm bg-transparent outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-black border border-[#2C2C2C]">
                  <MapPin size={14} color="#999" />
                  <input
                    value={detail.fields.Address || ""}
                    onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Address: e.target.value } })}
                    placeholder="Address"
                    className="flex-1 text-sm bg-transparent outline-none"
                  />
                </div>
                <input
                  value={detail.fields["Channel Handle"] || ""}
                  onChange={(e) =>
                    setDetail({ ...detail, fields: { ...detail.fields, "Channel Handle": e.target.value } })
                  }
                  placeholder="Handle / profile link"
                  className="text-sm px-2.5 py-2 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
                />
              </div>

              <input
                value={detail.fields["Next Action"] || ""}
                onChange={(e) =>
                  setDetail({ ...detail, fields: { ...detail.fields, "Next Action": e.target.value } })
                }
                placeholder="Next action"
                className="text-sm px-2.5 py-2 rounded-md outline-none bg-black border border-[#2C2C2C] text-white"
              />
              <textarea
                value={detail.fields.Notes || ""}
                onChange={(e) => setDetail({ ...detail, fields: { ...detail.fields, Notes: e.target.value } })}
                placeholder="Notes"
                rows={3}
                className="text-sm px-2.5 py-2 rounded-md outline-none resize-none bg-black border border-[#2C2C2C] text-white"
              />

              {detail.fields["Last Contact"] && (
                <p className="text-xs text-[#999] font-mono">
                  Last contact: {detail.fields["Last Contact"]} ({daysAgo(detail.fields["Last Contact"])})
                </p>
              )}

              <button
                onClick={saveDetail}
                disabled={saving}
                className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 bg-[#F0451F] text-white disabled:opacity-50"
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
