"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { austinDateStr } from "@/lib/austinDate";
import { Plus, X, RefreshCw, Save, Mail, Phone, Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const PAGE_SIZE = 10;

// A row starts as research and only becomes sendable once it has a real
// person/org and a usable email address.
const STAGES = [
  "Research Needed",
  "Ready for Outreach",
  "Contacted",
  "Replied",
  "Engaged",
  "Meeting",
  "Follow-up",
  "Partner",
  "Not Interested",
];

const EMAIL_STATUSES = ["Not Contacted", "Sent", "Replied", "No Response", "Bounced"];

const VERIFICATION_STATUSES = [
  "Research Needed",
  "Partially Verified",
  "Verified",
  // Legacy values from the original 500-target import -- kept so old rows
  // still display correctly instead of falling through to "Not set".
  "Research target; person not yet verified",
  "Verified organization; identify current person",
  "Verified named contact",
];

type ContactFields = {
  "Name / Target"?: string;
  Organization?: string;
  Role?: string;
  Category?: string;
  Priority?: number;
  "Campaign Day"?: number;
  "Daily Slot"?: number;
  Phone?: string;
  "Why They Matter to SplitMic"?: string;
  "Source / Research Starting Point"?: string;
  Website?: string;
  "City / Area"?: string;
  "Primary Source URL"?: string;
  "Secondary Source URL"?: string;
  "Verification Status"?: string;
  "Date Verified"?: string;
  Email?: string;
  "Email Status"?: string;
  "Email Last Contacted"?: string;
  "Email Follow-up Date"?: string;
  "LinkedIn Name"?: string;
  "LinkedIn URL"?: string;
  "LinkedIn Status"?: string;
  "LinkedIn Last Contacted"?: string;
  "Relationship Status"?: string;
  "Response Summary"?: string;
  "Feedback / Pain Point"?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
  Notes?: string;
};

type Contact = { id: string; fields: ContactFields };

const emptyForm: ContactFields = {
  "Name / Target": "",
  Organization: "",
  Role: "",
  Email: "",
  "Next Action": "",
  Notes: "",
};

function daysAgo(dateStr?: string) {
  if (!dateStr) return null;
  const today = new Date(austinDateStr() + "T00:00:00").getTime();
  const then = new Date(dateStr + "T00:00:00").getTime();
  const d = Math.round((today - then) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function pillStyle(active: boolean) {
  return {
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "#0a0705" : "var(--color-muted)",
    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
  };
}

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

export default function OutreachBoard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFields>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [searchByStage, setSearchByStage] = useState<Record<string, string>>({});
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to load from Airtable");
      const data = await res.json();
      setContacts(data.contacts);
      setSearchByStage({});
      setVisibleByStage({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, fields: ContactFields) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, ...fields } } : c)));
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      load();
    }
  };

  const moveStage = (id: string, stage: string) =>
    patch(id, { "Relationship Status": stage, ...(stage !== "New" ? {} : {}) });

  const createContact = async (stage: string) => {
    if (!form["Name / Target"]?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, "Relationship Status": stage }),
      });
      if (!res.ok) throw new Error("Failed to save contact");
      const created = await res.json();
      setContacts((prev) => [...prev, created]);
      setForm(emptyForm);
      setAddingStage(null);
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
      const res = await fetch(`/api/contacts/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail.fields),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setDetailField = (patchFields: ContactFields) =>
    setDetail((d) => (d ? { ...d, fields: { ...d.fields, ...patchFields } } : d));

  const byStage = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const c of contacts) {
      const s = c.fields["Relationship Status"] || "New";
      (map[s] ||= []).push(c);
    }
    return map;
  }, [contacts]);

  const totals = useMemo(() => {
    const emailed = contacts.filter((c) => c.fields["Email Status"] === "Sent").length;
    const ready = contacts.filter(
      (c) => (c.fields.Email || "").trim() && (c.fields["Email Status"] || "Not Contacted") === "Not Contacted"
    ).length;
    const needsResearch = contacts.filter((c) => !(c.fields.Email || "").trim()).length;
    return { emailed, ready, needsResearch, total: contacts.length };
  }, [contacts]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email pipeline</h2>
          <p className="text-sm text-muted font-mono mt-1">
            {totals.total} targets · {totals.ready} ready to email · {totals.emailed} emailed ·{" "}
            {totals.needsResearch} need an address
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCollapsed((prev) => {
                const allCollapsed = STAGES.every((s) => prev[s]);
                const next: Record<string, boolean> = {};
                for (const s of STAGES) next[s] = !allCollapsed;
                return next;
              })
            }
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all"
          >
            {STAGES.every((s) => collapsed[s]) ? "Expand all" : "Collapse all"}
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

      <div className="flex gap-3.5 overflow-x-auto pb-3 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {STAGES.map((stage) => {
          const stageContacts = byStage[stage] || [];
          const query = (searchByStage[stage] || "").trim().toLowerCase();
          const filtered = query
            ? stageContacts.filter((c) =>
                [c.fields["Name / Target"], c.fields.Organization, c.fields.Role, c.fields.Category]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()
                  .includes(query)
              )
            : stageContacts;
          const visibleCount = visibleByStage[stage] ?? PAGE_SIZE;
          const visible = filtered.slice(0, visibleCount);
          const remaining = filtered.length - visible.length;
          const isOver = overStage === stage;
          const isCollapsed = !!collapsed[stage];

          if (isCollapsed) {
            return (
              <button
                key={stage}
                onClick={() => setCollapsed((prev) => ({ ...prev, [stage]: false }))}
                className="flex-shrink-0 snap-start rounded-2xl flex flex-col items-center gap-3 bg-surface2 border border-border py-4 hover:border-accent transition-all"
                style={{ width: 52, minHeight: "65vh" }}
                title={`Expand ${stage}`}
              >
                <ChevronRight size={16} color="var(--color-muted)" />
                <span
                  className="text-sm px-2 py-0.5 rounded-full bg-surface3 text-muted font-mono flex-shrink-0"
                >
                  {stageContacts.length}
                </span>
                <span
                  className="text-sm font-bold text-foreground flex-1"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {stage}
                </span>
              </button>
            );
          }

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
                width: "min(88vw, 300px)",
                minHeight: "65vh",
                borderColor: isOver ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <div className="px-4 py-3.5 flex items-center justify-between border-b border-border">
                <button
                  onClick={() => setCollapsed((prev) => ({ ...prev, [stage]: true }))}
                  className="flex items-center gap-1.5 text-left"
                  title="Collapse column"
                >
                  <ChevronLeft size={15} color="var(--color-muted)" />
                  <h3 className="text-base font-bold text-foreground">{stage}</h3>
                </button>
                <span className="text-sm px-2.5 py-1 rounded-full bg-surface3 text-muted font-mono">
                  {stageContacts.length}
                </span>
              </div>

              <div className="p-3 border-b border-border">
                {addingStage === stage ? (
                  <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface3 border border-border">
                    <input
                      autoFocus
                      value={form["Name / Target"]}
                      onChange={(e) => setForm({ ...form, "Name / Target": e.target.value })}
                      placeholder="Name"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Organization}
                      onChange={(e) => setForm({ ...form, Organization: e.target.value })}
                      placeholder="Organization"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Role}
                      onChange={(e) => setForm({ ...form, Role: e.target.value })}
                      placeholder="Role"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Email}
                      onChange={(e) => setForm({ ...form, Email: e.target.value })}
                      placeholder="Email"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => createContact(stage)}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={() => {
                          setAddingStage(null);
                          setForm(emptyForm);
                        }}
                        className="px-3 py-2.5 rounded-lg bg-surface2"
                      >
                        <X size={15} color="var(--color-muted)" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingStage(stage)}
                    className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm text-muted border border-dashed border-borderHover transition-all hover:border-accent hover:text-accentLight"
                  >
                    <Plus size={15} /> Add contact
                  </button>
                )}
              </div>

              {stageContacts.length > 0 && (
                <div className="px-3 pt-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-border">
                    <Search size={14} color="var(--color-muted)" />
                    <input
                      value={searchByStage[stage] || ""}
                      onChange={(e) => {
                        setSearchByStage({ ...searchByStage, [stage]: e.target.value });
                        setVisibleByStage({ ...visibleByStage, [stage]: PAGE_SIZE });
                      }}
                      placeholder="Name, org, role…"
                      className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground placeholder:text-muted"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 flex flex-col gap-2.5 flex-1">
                {stageContacts.length === 0 && addingStage !== stage && (
                  <p className="text-sm italic px-1 py-3 text-muted">No one here yet.</p>
                )}
                {stageContacts.length > 0 && filtered.length === 0 && (
                  <p className="text-sm italic px-1 py-3 text-muted">
                    No matches for &ldquo;{searchByStage[stage]}&rdquo;.
                  </p>
                )}
                {visible.map((c) => {
                  const f = c.fields;
                  const lastTouch = f["Email Last Contacted"] || f["LinkedIn Last Contacted"];
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      className="card-hover rounded-xl p-3.5 flex flex-col gap-2.5 cursor-pointer bg-surface3 border border-border"
                      style={{ opacity: dragId === c.id ? 0.4 : 1 }}
                    >
                      <div onClick={() => setDetail(c)} className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold truncate text-foreground">
                            {f["Name / Target"]}
                          </p>
                          <p className="text-sm text-muted truncate">
                            {[f.Role, f.Organization].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {f["Verification Status"]?.startsWith("Verified") && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-mono"
                              style={{
                                background: f["Verification Status"] === "Partially Verified" ? "rgba(242,201,76,0.15)" : "rgba(95,191,122,0.15)",
                                color: f["Verification Status"] === "Partially Verified" ? "#f2c94c" : "#5fbf7a",
                              }}
                            >
                              {f["Verification Status"] === "Partially Verified" ? "Partial" : "Verified"}
                            </span>
                          )}
                          {f.Priority ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surfaceElevated text-accentLight font-mono">
                              P{f.Priority}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div onClick={() => setDetail(c)} className="flex items-center gap-1.5 flex-wrap">
                        {f.Category && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceElevated text-textSecondary">
                            {f.Category}
                          </span>
                        )}
                        {f.Email ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-surfaceElevated text-textSecondary flex items-center gap-1">
                            <Mail size={11} /> {f["Email Status"] || "Not Contacted"}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-surfaceElevated text-muted flex items-center gap-1">
                            <Mail size={11} /> No email yet
                          </span>
                        )}
                        {f.Phone && (
                          <span className="text-xs px-2 py-1 rounded-full bg-surfaceElevated text-textSecondary flex items-center gap-1">
                            <Phone size={11} /> {f.Phone}
                          </span>
                        )}
                      </div>

                      {(lastTouch || f["Next Action"]) && (
                        <div onClick={() => setDetail(c)} className="flex flex-col gap-1">
                          {lastTouch && (
                            <span className="text-xs text-muted font-mono">Last: {daysAgo(lastTouch)}</span>
                          )}
                          {f["Next Action"] && (
                            <span className="text-xs text-accentLight truncate">→ {f["Next Action"]}</span>
                          )}
                        </div>
                      )}

                      {/* Touch-friendly stage move -- drag-and-drop needs a mouse, this works on tablet */}
                      <select
                        value={stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => moveStage(c.id, e.target.value)}
                        className="text-sm px-3 py-2.5 rounded-lg outline-none bg-black/30 border border-border text-textSecondary font-mono"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            Move to: {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {remaining > 0 && (
                  <button
                    onClick={() => setVisibleByStage({ ...visibleByStage, [stage]: filtered.length })}
                    className="w-full py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm text-textSecondary bg-black/20 border border-border transition-all hover:border-accent hover:text-accentLight"
                  >
                    <ChevronDown size={15} /> Show {remaining} more
                  </button>
                )}
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
            className="w-full max-w-lg rounded-2xl p-6 bg-surface2 border border-border max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <input
                value={detail.fields["Name / Target"] || ""}
                onChange={(e) => setDetailField({ "Name / Target": e.target.value })}
                className="text-2xl font-bold bg-transparent outline-none flex-1 min-w-0 text-foreground"
              />
              <button onClick={() => setDetail(null)} className="mt-1">
                <X size={20} color="var(--color-muted)" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-border overflow-x-auto">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDetailField({ "Relationship Status": s })}
                    className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={pillStyle((detail.fields["Relationship Status"] || "New") === s)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Category">
                  <input
                    value={detail.fields.Category || ""}
                    onChange={(e) => setDetailField({ Category: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="City / Area">
                  <input
                    value={detail.fields["City / Area"] || ""}
                    onChange={(e) => setDetailField({ "City / Area": e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Verification">
                <select
                  value={detail.fields["Verification Status"] || ""}
                  onChange={(e) => setDetailField({ "Verification Status": e.target.value })}
                  className={inputCls}
                >
                  <option value="">Not set</option>
                  {VERIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              {detail.fields["Date Verified"] && (
                <p className="text-xs text-muted font-mono -mt-2">
                  Verified {detail.fields["Date Verified"]}
                </p>
              )}

              {detail.fields["Why They Matter to SplitMic"] && (
                <div className="px-4 py-3 rounded-lg bg-black/20 border border-border">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted font-mono mb-1.5">
                    Why they matter
                  </p>
                  <p className="text-sm text-textSecondary leading-relaxed">
                    {detail.fields["Why They Matter to SplitMic"]}
                  </p>
                </div>
              )}

              {[
                { label: "Research starting point", url: detail.fields["Source / Research Starting Point"] },
                { label: "Website", url: detail.fields.Website },
                { label: "Primary source", url: detail.fields["Primary Source URL"] },
                { label: "Secondary source", url: detail.fields["Secondary Source URL"] },
              ]
                .filter((l) => l.url)
                .map((l) => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3.5 py-3 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                  >
                    <ExternalLink size={14} /> {l.label}
                  </a>
                ))}

              <div className="pt-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-2.5">Contact</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-black/30 border border-border">
                    <ExternalLink size={16} color="var(--color-muted)" />
                    <input
                      value={detail.fields["LinkedIn URL"] || ""}
                      onChange={(e) => setDetailField({ "LinkedIn URL": e.target.value })}
                      placeholder="LinkedIn URL"
                      className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-black/30 border border-border">
                    <Mail size={16} color="var(--color-muted)" />
                    <input
                      value={detail.fields.Email || ""}
                      onChange={(e) => setDetailField({ Email: e.target.value })}
                      placeholder="Email address"
                      className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
                    />
                  </div>
                  {detail.fields.Email && (
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(detail.fields.Email)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                    >
                      <ExternalLink size={14} /> Compose in Gmail
                    </a>
                  )}
                  <Field label="Phone">
                    <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-black/30 border border-border">
                      <Phone size={16} color="var(--color-muted)" />
                      <input
                        value={detail.fields.Phone || ""}
                        onChange={(e) => setDetailField({ Phone: e.target.value })}
                        placeholder="Phone"
                        className="flex-1 min-w-0 text-base bg-transparent outline-none text-foreground placeholder:text-muted"
                      />
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Status">
                      <select
                        value={detail.fields["Email Status"] || "Not Contacted"}
                        onChange={(e) => setDetailField({ "Email Status": e.target.value })}
                        className={inputCls}
                      >
                        {EMAIL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Last contacted">
                      <input
                        type="date"
                        value={detail.fields["Email Last Contacted"] || ""}
                        onChange={(e) => setDetailField({ "Email Last Contacted": e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Follow-up date">
                    <input
                      type="date"
                      value={detail.fields["Email Follow-up Date"] || ""}
                      onChange={(e) => setDetailField({ "Email Follow-up Date": e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-2.5">
                  Relationship
                </p>
                <div className="flex flex-col gap-3">
                  <Field label="Response summary">
                    <textarea
                      value={detail.fields["Response Summary"] || ""}
                      onChange={(e) => setDetailField({ "Response Summary": e.target.value })}
                      rows={2}
                      className={inputCls + " resize-none"}
                    />
                  </Field>
                  <Field label="Feedback / pain point">
                    <textarea
                      value={detail.fields["Feedback / Pain Point"] || ""}
                      onChange={(e) => setDetailField({ "Feedback / Pain Point": e.target.value })}
                      rows={2}
                      className={inputCls + " resize-none"}
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Next action">
                      <input
                        value={detail.fields["Next Action"] || ""}
                        onChange={(e) => setDetailField({ "Next Action": e.target.value })}
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
                  <Field label="Notes">
                    <textarea
                      value={detail.fields.Notes || ""}
                      onChange={(e) => setDetailField({ Notes: e.target.value })}
                      rows={3}
                      className={inputCls + " resize-none"}
                    />
                  </Field>
                </div>
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
                <Save size={17} /> {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
