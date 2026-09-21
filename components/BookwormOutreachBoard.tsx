"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, X, RefreshCw, Save, Mail, Phone, Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

const PAGE_SIZE = 10;

// Bookworm has no cold-sales funnel -- the only real question for each
// contact is whether they've joined the free Whop community yet.
const STAGES = ["New", "Contacted", "Replied", "Joined Whop", "Not Interested"];

const PRIORITIES = ["A (Top 10)", "A", "B", "C"];

type BookwormContactFields = {
  Name?: string;
  Category?: string;
  Priority?: string;
  Opportunity?: string;
  Angle?: string;
  Address?: string;
  Phone?: string;
  Email?: string;
  "Channel Handle"?: string;
  "Relationship Status"?: string;
  "Next Action"?: string;
  "Last Contact"?: string;
  Notes?: string;
};

type Contact = { id: string; fields: BookwormContactFields };

const emptyForm: BookwormContactFields = {
  Name: "",
  Category: "",
  Email: "",
  "Channel Handle": "",
};

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

export default function BookwormOutreachBoard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [form, setForm] = useState<BookwormContactFields>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [searchByStage, setSearchByStage] = useState<Record<string, string>>({});
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookworm-contacts");
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

  const patch = async (id: string, fields: BookwormContactFields) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, ...fields } } : c)));
    try {
      const res = await fetch(`/api/bookworm-contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      load();
    }
  };

  const moveStage = (id: string, stage: string) => patch(id, { "Relationship Status": stage });

  const createContact = async (stage: string) => {
    if (!form.Name?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookworm-contacts", {
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
      const res = await fetch(`/api/bookworm-contacts/${detail.id}`, {
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

  const removeContact = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookworm-contacts/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setContacts((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setDetail((d) => (d?.id === pendingDelete.id ? null : d));
      setPendingDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setPendingDelete(null);
    } finally {
      setSaving(false);
    }
  };

  const setDetailField = (patchFields: BookwormContactFields) =>
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
    const contacted = contacts.filter((c) => (c.fields["Relationship Status"] || "New") !== "New").length;
    const joined = contacts.filter((c) => c.fields["Relationship Status"] === "Joined Whop").length;
    return { total: contacts.length, contacted, joined };
  }, [contacts]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bookworm email</h2>
          <p className="text-sm text-muted font-mono mt-1">
            {totals.total} Austin targets · {totals.contacted} contacted · {totals.joined} joined Whop
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
                [c.fields.Name, c.fields.Category, c.fields.Opportunity].filter(Boolean).join(" ").toLowerCase().includes(query)
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
                <span className="text-sm px-2 py-0.5 rounded-full bg-surface3 text-muted font-mono flex-shrink-0">
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
                      value={form.Name}
                      onChange={(e) => setForm({ ...form, Name: e.target.value })}
                      placeholder="Name"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Category}
                      onChange={(e) => setForm({ ...form, Category: e.target.value })}
                      placeholder="Category (Book Club, Bookstore, Author...)"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form.Email}
                      onChange={(e) => setForm({ ...form, Email: e.target.value })}
                      placeholder="Email"
                      className="text-base px-3 py-2.5 rounded-lg outline-none bg-black/40 border border-border text-foreground placeholder:text-muted"
                    />
                    <input
                      value={form["Channel Handle"]}
                      onChange={(e) => setForm({ ...form, "Channel Handle": e.target.value })}
                      placeholder="Channel handle (@instagram...)"
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
                      placeholder="Name, category, opportunity…"
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
                  <p className="text-sm italic px-1 py-3 text-muted">No matches for &ldquo;{searchByStage[stage]}&rdquo;.</p>
                )}
                {visible.map((c) => {
                  const f = c.fields;
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
                          <p className="text-base font-semibold truncate text-foreground">{f.Name}</p>
                          <p className="text-sm text-muted truncate">{f.Opportunity}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {f.Priority && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surfaceElevated text-accentLight font-mono">
                              {f.Priority}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(c);
                            }}
                            title="Delete contact"
                            aria-label={`Delete ${f.Name || "contact"}`}
                            className="p-1 rounded-md text-muted hover:text-accentLight hover:bg-surfaceElevated transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
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
                            <Mail size={11} /> has email
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-surfaceElevated text-muted flex items-center gap-1">
                            <Mail size={11} /> no email yet
                          </span>
                        )}
                        {f["Channel Handle"] && (
                          <span className="text-xs px-2 py-1 rounded-full bg-surfaceElevated text-textSecondary">
                            {f["Channel Handle"]}
                          </span>
                        )}
                      </div>

                      {f["Next Action"] && (
                        <div onClick={() => setDetail(c)}>
                          <span className="text-xs text-accentLight truncate">→ {f["Next Action"]}</span>
                        </div>
                      )}

                      {/* Touch-friendly stage move -- drag-and-drop needs a mouse */}
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
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70" onClick={() => setDetail(null)}>
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
                <Field label="Category">
                  <input
                    value={detail.fields.Category || ""}
                    onChange={(e) => setDetailField({ Category: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={detail.fields.Priority || ""}
                    onChange={(e) => setDetailField({ Priority: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Not set</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Opportunity">
                  <input
                    value={detail.fields.Opportunity || ""}
                    onChange={(e) => setDetailField({ Opportunity: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Angle">
                  <input
                    value={detail.fields.Angle || ""}
                    onChange={(e) => setDetailField({ Angle: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Address">
                <input
                  value={detail.fields.Address || ""}
                  onChange={(e) => setDetailField({ Address: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <div className="pt-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-2.5">Contact</p>
                <div className="flex flex-col gap-3">
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
                  <Field label="Channel handle">
                    <input
                      value={detail.fields["Channel Handle"] || ""}
                      onChange={(e) => setDetailField({ "Channel Handle": e.target.value })}
                      placeholder="@instagram, TikTok, Bookstagram..."
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-2.5">Follow-up</p>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Next action">
                      <input
                        value={detail.fields["Next Action"] || ""}
                        onChange={(e) => setDetailField({ "Next Action": e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Last contact">
                      <input
                        type="date"
                        value={detail.fields["Last Contact"] || ""}
                        onChange={(e) => setDetailField({ "Last Contact": e.target.value })}
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
              <button
                onClick={() => setPendingDelete(detail)}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-muted border border-border hover:text-accentLight hover:border-accent transition-all disabled:opacity-50"
              >
                <Trash2 size={15} /> Delete contact
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDeleteDialog
          name={pendingDelete.fields.Name || ""}
          busy={saving}
          onConfirm={removeContact}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
