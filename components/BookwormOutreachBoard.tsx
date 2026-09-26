"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, X, RefreshCw, Save, Mail, Phone, Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Trash2, List, Columns3, ArrowRight, CheckCircle2 } from "lucide-react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import { readApiJson } from "@/lib/apiClient";

const PAGE_SIZE = 10;

// Existing community records stay in this table, while new routine email
// outreach prioritizes business consultants and keeps partnerships separate.
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
  "Next Action Date"?: string;
  "Profile URL"?: string;
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
  const [activeStage, setActiveStage] = useState(STAGES[0]);
  const [viewMode, setViewMode] = useState<"queue" | "pipeline">("queue");
  const [queueQuery, setQueueQuery] = useState("");
  const [queueVisible, setQueueVisible] = useState(PAGE_SIZE);
  const boardRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookworm-contacts");
      const data = await readApiJson<{ contacts: Contact[] }>(res, "Could not load Bookworm email records.");
      setContacts(data.contacts);
      setSearchByStage({});
      setVisibleByStage({});
      setQueueVisible(PAGE_SIZE);
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
      const created = await readApiJson<Contact>(res, "Could not save this Bookworm contact.");
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
      const updated = await readApiJson<Contact>(res, "Could not save this Bookworm contact.");
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

  const goToStage = useCallback((stage: string) => {
    setActiveStage(stage);
    setQueueVisible(PAGE_SIZE);
    const board = boardRef.current;
    const target = stageRefs.current[stage];
    if (!board || !target) return;
    board.scrollTo({ left: Math.max(0, target.offsetLeft - board.offsetLeft - 12), behavior: "smooth" });
  }, []);

  const stepStage = (direction: -1 | 1) => {
    const current = Math.max(0, STAGES.indexOf(activeStage));
    goToStage(STAGES[Math.min(STAGES.length - 1, Math.max(0, current + direction))]);
  };

  const trackVisibleStage = () => {
    const board = boardRef.current;
    if (!board) return;
    const maxScroll = board.scrollWidth - board.clientWidth;
    if (board.scrollLeft <= 4) {
      setActiveStage(STAGES[0]);
      return;
    }
    if (board.scrollLeft >= maxScroll - 4) {
      setActiveStage(STAGES[STAGES.length - 1]);
      return;
    }
    let closest = STAGES[0];
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const stage of STAGES) {
      const target = stageRefs.current[stage];
      if (!target) continue;
      const distance = Math.abs(target.offsetLeft - board.offsetLeft - board.scrollLeft);
      if (distance < closestDistance) {
        closest = stage;
        closestDistance = distance;
      }
    }
    setActiveStage(closest);
  };

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
    const missingEmail = contacts.filter((contact) => !(contact.fields.Email || "").trim()).length;
    return {
      total: contacts.length,
      new: (byStage.New || []).length,
      missingEmail,
      contacted: (byStage.Contacted || []).length,
      replied: (byStage.Replied || []).length,
      joined: (byStage["Joined Whop"] || []).length,
    };
  }, [contacts, byStage]);

  const filteredQueue = useMemo(() => {
    const query = queueQuery.trim().toLowerCase();
    const stageContacts = byStage[activeStage] || [];
    if (!query) return stageContacts;
    return stageContacts.filter((contact) =>
      [contact.fields.Name, contact.fields.Category, contact.fields.Opportunity, contact.fields.Email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [activeStage, byStage, queueQuery]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Email outreach</h2>
          <p className="mt-1 text-sm text-muted">Work the next best Bookworm partner, then use the pipeline for the bigger picture.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="col-span-2 grid grid-cols-2 rounded-xl border border-border bg-surface2 p-1 sm:col-span-1">
            <button
              onClick={() => setViewMode("queue")}
              aria-pressed={viewMode === "queue"}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                viewMode === "queue" ? "bg-surfaceElevated text-foreground" : "text-muted hover:text-white"
              }`}
            >
              <List size={15} /> Queue
            </button>
            <button
              onClick={() => setViewMode("pipeline")}
              aria-pressed={viewMode === "pipeline"}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                viewMode === "pipeline" ? "bg-surfaceElevated text-foreground" : "text-muted hover:text-white"
              }`}
            >
              <Columns3 size={15} /> Pipeline
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-50 sm:col-span-1"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-[rgba(232,67,10,0.4)] bg-[rgba(232,67,10,0.1)] px-4 py-3 text-sm text-accentLight sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button onClick={load} disabled={loading} className="min-h-10 flex-shrink-0 rounded-lg border border-accent/50 px-3 font-semibold text-foreground hover:bg-white/[0.04] disabled:opacity-50">
            {loading ? "Checking…" : "Try again"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Total prospects", value: totals.total },
          { label: "New", value: totals.new },
          { label: "Contacted", value: totals.contacted },
          { label: "Replies", value: totals.replied },
          { label: "Joined Whop", value: totals.joined },
        ].map((metric, index) => (
          <div key={metric.label} className={`rounded-xl border border-border bg-surface2 px-3.5 py-3.5 sm:px-4 ${index === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-3 rounded-2xl border border-accent/35 bg-[linear-gradient(115deg,rgba(232,67,10,0.14),rgba(18,18,25,0.9)_65%)] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white"><ArrowRight size={19} /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accentLight">Best next action</p>
          <p className="mt-1 font-semibold text-foreground">
            {totals.new > 0 ? "Open the next new Bookworm prospect." : totals.contacted > 0 ? "Review contacted prospects and follow up." : "Review replies and community joins."}
          </p>
          <p className="mt-1 text-sm text-textSecondary">
            {totals.missingEmail > 0 ? `${totals.missingEmail} prospects still need an email address.` : "Every prospect currently has an email address."}
          </p>
        </div>
        <button
          onClick={() => goToStage(totals.new > 0 ? "New" : totals.contacted > 0 ? "Contacted" : "Replied")}
          className="min-h-11 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 sm:justify-self-end"
        >
          Open queue
        </button>
      </section>

      <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {STAGES.map((stage) => {
          const isDropTarget = overStage === stage && dragId;
          return (
            <button
              key={stage}
              onClick={() => goToStage(stage)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((current) => current === stage ? null : current)}
              onDrop={(event) => {
                event.preventDefault();
                const contactId = dragId || event.dataTransfer.getData("text/plain");
                if (contactId) moveStage(contactId, stage);
                setDragId(null);
                setOverStage(null);
                goToStage(stage);
              }}
              aria-current={activeStage === stage ? "step" : undefined}
              className={`flex min-h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                isDropTarget
                  ? "border-accent bg-accent text-white"
                  : activeStage === stage
                    ? "border-accent bg-[rgba(232,67,10,0.14)] text-foreground"
                    : "border-border bg-surface2 text-textSecondary hover:border-borderHover hover:text-white"
              }`}
            >
              {stage}
              <span className="rounded-full bg-surface3 px-2 py-0.5 font-mono text-xs text-muted">{(byStage[stage] || []).length}</span>
            </button>
          );
        })}
      </div>

      {viewMode === "queue" ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface2">
            <div className="flex flex-col gap-3 border-b border-border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Current queue</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{activeStage}</h3>
              </div>
              <div className="flex min-w-0 gap-2">
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-black/25 px-3 sm:w-64">
                  <Search size={15} className="flex-shrink-0 text-muted" />
                  <input value={queueQuery} onChange={(event) => { setQueueQuery(event.target.value); setQueueVisible(PAGE_SIZE); }} placeholder="Search this queue…" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted sm:text-sm" />
                </label>
                <button onClick={() => setAddingStage(activeStage)} className="flex min-h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface3 px-3 text-sm font-semibold text-textSecondary transition-all hover:border-accent hover:text-white sm:px-4">
                  <Plus size={16} /> <span className="hidden sm:inline">Add prospect</span>
                </button>
              </div>
            </div>

            {addingStage === activeStage && (
              <div className="grid gap-2 border-b border-border bg-black/15 p-3.5 sm:grid-cols-2 lg:grid-cols-4 lg:p-4">
                <input autoFocus value={form.Name} onChange={(event) => setForm({ ...form, Name: event.target.value })} placeholder="Name" className={inputCls} />
                <input value={form.Category} onChange={(event) => setForm({ ...form, Category: event.target.value })} placeholder="Category" className={inputCls} />
                <input value={form.Email} onChange={(event) => setForm({ ...form, Email: event.target.value })} placeholder="Email" className={inputCls} />
                <input value={form["Channel Handle"]} onChange={(event) => setForm({ ...form, "Channel Handle": event.target.value })} placeholder="Channel handle" className={inputCls} />
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
                  <button onClick={() => { setAddingStage(null); setForm(emptyForm); }} className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm text-textSecondary hover:text-white lg:flex-none">Cancel</button>
                  <button onClick={() => createContact(activeStage)} disabled={saving || !form.Name?.trim()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-40 lg:flex-none"><Save size={15} /> Save prospect</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-border">
              {filteredQueue.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface3 text-muted"><CheckCircle2 size={20} /></div>
                  <p className="mt-3 font-semibold text-foreground">{queueQuery ? "No matching prospects" : `The ${activeStage.toLowerCase()} queue is clear.`}</p>
                  <p className="mt-1 text-sm text-muted">{queueQuery ? "Try a different name, category, opportunity, or email." : "Choose another stage above to keep working."}</p>
                </div>
              ) : filteredQueue.slice(0, queueVisible).map((contact) => {
                const fields = contact.fields;
                return (
                  <article
                    key={contact.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", contact.id);
                      setDragId(contact.id);
                    }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    className="grid cursor-grab gap-3 p-3.5 transition-colors hover:bg-white/[0.025] active:cursor-grabbing sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(190px,0.55fr)_auto] lg:items-center"
                    style={{ opacity: dragId === contact.id ? 0.45 : 1 }}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <button onClick={() => setDetail(contact)} className="min-w-0 truncate text-left text-base font-semibold text-foreground hover:text-accentLight">{fields.Name || "Unnamed prospect"}</button>
                        {fields.Priority && <span className="rounded-full bg-surfaceElevated px-2 py-0.5 font-mono text-xs text-accentLight">{fields.Priority}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{fields.Opportunity || fields.Category || "Opportunity not set"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-textSecondary">
                        {fields.Category && <span className="rounded-full bg-surfaceElevated px-2.5 py-1">{fields.Category}</span>}
                        {fields.Email ? <a href={`mailto:${fields.Email}`} className="flex items-center gap-1 rounded-full bg-surfaceElevated px-2.5 py-1 hover:text-white"><Mail size={11} /> {fields.Email}</a> : <span className="flex items-center gap-1 rounded-full bg-surfaceElevated px-2.5 py-1 text-muted"><Mail size={11} /> No email yet</span>}
                        {fields.Phone && <a href={`tel:${fields.Phone}`} className="flex items-center gap-1 rounded-full bg-surfaceElevated px-2.5 py-1 hover:text-white"><Phone size={11} /> {fields.Phone}</a>}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-xl bg-black/20 px-3 py-2.5">
                      <p className="text-xs uppercase tracking-[0.1em] text-muted">Next action</p>
                      <p className="mt-1 truncate text-sm text-foreground">{fields["Next Action"] || (fields.Email ? "Review and continue outreach" : "Find and verify an email")}</p>
                      {fields["Last Contact"] && <p className="mt-1 font-mono text-xs text-muted">Last contact: {fields["Last Contact"]}</p>}
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:flex lg:items-center">
                      <select value={activeStage} onClick={(event) => event.stopPropagation()} onChange={(event) => moveStage(contact.id, event.target.value)} aria-label={`Move ${fields.Name || "prospect"} to another stage`} className="min-h-11 min-w-0 rounded-xl border border-border bg-black/30 px-3 text-sm text-textSecondary outline-none">
                        {STAGES.map((stage) => <option key={stage} value={stage}>Move to: {stage}</option>)}
                      </select>
                      <button onClick={() => setDetail(contact)} className="min-h-11 rounded-xl border border-border bg-surface3 px-3 text-sm font-semibold text-foreground transition-all hover:border-accent sm:px-4">Open</button>
                    </div>
                  </article>
                );
              })}
            </div>
            {filteredQueue.length > queueVisible && (
              <div className="border-t border-border p-3"><button onClick={() => setQueueVisible(filteredQueue.length)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-black/20 text-sm font-semibold text-textSecondary hover:border-accent hover:text-white"><ChevronDown size={15} /> Show {filteredQueue.length - queueVisible} more</button></div>
            )}
          </section>

          <aside className="rounded-2xl border border-border bg-surface2 p-4 xl:self-start xl:sticky xl:top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accentLight">How today moves forward</p>
            <ol className="mt-4 space-y-4">
              {[["1", "Review", "Open the prospect and confirm the best partnership angle."], ["2", "Reach out", "Send a relevant message and move them to Contacted."], ["3", "Follow through", "Move replies and new Whop members forward."]].map(([number, title, description]) => (
                <li key={number} className="flex gap-3"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface3 font-mono text-xs font-bold text-accentLight">{number}</span><div><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p></div></li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl border border-border bg-black/20 p-3"><p className="text-xs leading-relaxed text-textSecondary">Drag a prospect onto a stage above, or use the Move to field. Either action updates Google Sheets immediately.</p></div>
          </aside>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface2/70 p-2.5 sm:flex-row sm:items-center">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex">
              <button onClick={() => stepStage(-1)} disabled={activeStage === STAGES[0]} aria-label="Previous pipeline stage" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-black/20 text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-30"><ChevronLeft size={19} /></button>
              <div className="min-w-0 px-2 text-center sm:text-left"><p className="truncate text-sm font-semibold text-foreground">{activeStage}</p><p className="text-xs text-muted">{(byStage[activeStage] || []).length} prospects in this stage</p></div>
              <button onClick={() => stepStage(1)} disabled={activeStage === STAGES[STAGES.length - 1]} aria-label="Next pipeline stage" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-black/20 text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-30"><ChevronRight size={19} /></button>
            </div>
            <p className="px-1 text-xs leading-relaxed text-muted sm:ml-2">Swipe, use the arrows, drag the scrollbar, or drop a card onto a stage above.</p>
            <button
              onClick={() => setCollapsed((prev) => { const allCollapsed = STAGES.every((stage) => prev[stage]); const next: Record<string, boolean> = {}; for (const stage of STAGES) next[stage] = !allCollapsed; return next; })}
              className="min-h-10 flex-shrink-0 rounded-xl border border-border bg-black/20 px-3 text-sm text-textSecondary transition-all hover:border-accent hover:text-white sm:ml-auto"
            >
              {STAGES.every((stage) => collapsed[stage]) ? "Expand all" : "Collapse all"}
            </button>
          </div>

      <div
        ref={boardRef}
        onScroll={trackVisibleStage}
        className="pipeline-scrollbar relative -mx-3 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-3 pb-4 sm:mx-0 sm:snap-none sm:px-0"
      >
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
                ref={(node) => {
                  stageRefs.current[stage] = node;
                }}
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
              ref={(node) => {
                stageRefs.current[stage] = node;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const contactId = dragId || e.dataTransfer.getData("text/plain");
                if (contactId) moveStage(contactId, stage);
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
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", c.id);
                        setDragId(c.id);
                      }}
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
        </>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5" onClick={() => setDetail(null)}>
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <input
                value={detail.fields.Name || ""}
                onChange={(e) => setDetailField({ Name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-xl font-bold text-foreground outline-none sm:text-2xl"
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

              <Field label="Profile URL">
                <input
                  value={detail.fields["Profile URL"] || ""}
                  onChange={(e) => setDetailField({ "Profile URL": e.target.value })}
                  placeholder="LinkedIn or website profile"
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
                    <Field label="Follow-up date">
                      <input
                        type="date"
                        value={detail.fields["Next Action Date"] || ""}
                        onChange={(e) => setDetailField({ "Next Action Date": e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Last contact">
                    <input
                      type="date"
                      value={detail.fields["Last Contact"] || ""}
                      onChange={(e) => setDetailField({ "Last Contact": e.target.value })}
                      className={inputCls}
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
