"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { austinDateStr } from "@/lib/austinDate";
import { Plus, X, RefreshCw, Save, Mail, Phone, Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFields>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [searchByStage, setSearchByStage] = useState<Record<string, string>>({});
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeStage, setActiveStage] = useState(STAGES[0]);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchDrafts, setResearchDrafts] = useState<Record<string, string>>({});
  const [researchSavingId, setResearchSavingId] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(refresh ? "/api/contacts?refresh=1" : "/api/contacts");
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

  const removeContact = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${pendingDelete.id}`, { method: "DELETE" });
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

  const setDetailField = (patchFields: ContactFields) =>
    setDetail((d) => (d ? { ...d, fields: { ...d.fields, ...patchFields } } : d));

  const goToStage = useCallback((stage: string) => {
    const board = boardRef.current;
    const target = stageRefs.current[stage];
    if (!board || !target) return;
    board.scrollTo({ left: Math.max(0, target.offsetLeft - board.offsetLeft - 12), behavior: "smooth" });
    setActiveStage(stage);
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
    const emailed = contacts.filter((c) => c.fields["Email Status"] === "Sent").length;
    const ready = contacts.filter(
      (c) => (c.fields.Email || "").trim() && (c.fields["Email Status"] || "Not Contacted") === "Not Contacted"
    ).length;
    const needsResearch = contacts.filter((c) => !(c.fields.Email || "").trim()).length;
    return { emailed, ready, needsResearch, total: contacts.length };
  }, [contacts]);

  const researchQueue = useMemo(
    () =>
      contacts
        .filter((c) => !(c.fields.Email || "").trim())
        .sort(
          (a, b) =>
            (a.fields["Campaign Day"] || Number.MAX_SAFE_INTEGER) -
              (b.fields["Campaign Day"] || Number.MAX_SAFE_INTEGER) ||
            (a.fields["Daily Slot"] || Number.MAX_SAFE_INTEGER) -
              (b.fields["Daily Slot"] || Number.MAX_SAFE_INTEGER)
        ),
    [contacts]
  );

  const saveResearchEmail = async (contact: Contact) => {
    const email = (researchDrafts[contact.id] || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResearchError("Enter a complete email address before saving.");
      return;
    }
    setResearchSavingId(contact.id);
    setResearchError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email }),
      });
      if (!res.ok) throw new Error("Could not save this email address");
      const updated = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setResearchDrafts((prev) => {
        const next = { ...prev };
        delete next[contact.id];
        return next;
      });
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "Could not save this email address");
    } finally {
      setResearchSavingId(null);
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email pipeline</h2>
          <p className="mt-1 text-sm text-muted">Connecting to Airtable…</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading outreach contacts">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-2xl border border-border bg-surface2" />
          ))}
        </div>
      </div>
    );
  }

  if (error && contacts.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(232,67,10,0.4)] bg-[rgba(232,67,10,0.1)] p-5">
        <h2 className="text-lg font-bold text-foreground">Airtable did not respond</h2>
        <p className="mt-2 text-sm text-accentLight">{error}</p>
        <button
          onClick={() => load(true)}
          className="mt-4 min-h-11 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

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
        <div className="grid w-full grid-cols-2 gap-2 min-[720px]:flex min-[720px]:w-auto min-[720px]:items-center">
          <button
            onClick={() => setResearchOpen(true)}
            disabled={totals.needsResearch === 0}
            className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-accent/50 bg-[rgba(232,67,10,0.1)] px-4 py-2.5 text-sm font-semibold text-accentLight transition-all hover:border-accent hover:bg-[rgba(232,67,10,0.16)] disabled:opacity-50 min-[720px]:col-span-1"
          >
            <Search size={15} /> Research {totals.needsResearch} emails
          </button>
          <button
            onClick={() =>
              setCollapsed((prev) => {
                const allCollapsed = STAGES.every((s) => prev[s]);
                const next: Record<string, boolean> = {};
                for (const s of STAGES) next[s] = !allCollapsed;
                return next;
              })
            }
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface2 px-3 py-2.5 text-sm text-textSecondary transition-all hover:border-accent hover:text-white sm:px-5"
          >
            {STAGES.every((s) => collapsed[s]) ? "Expand all" : "Collapse all"}
          </button>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface2 px-3 py-2.5 text-sm text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-50 sm:px-5"
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

      <div className="rounded-2xl border border-border bg-surface2/70 p-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => stepStage(-1)}
            disabled={activeStage === STAGES[0]}
            aria-label="Previous pipeline stage"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-black/20 text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-30"
          >
            <ChevronLeft size={19} />
          </button>
          <div className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto px-0.5 py-0.5">
            {STAGES.map((stage) => (
              <button
                key={stage}
                onClick={() => goToStage(stage)}
                aria-current={activeStage === stage ? "step" : undefined}
                className={`flex min-h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition-all sm:px-3.5 ${
                  activeStage === stage
                    ? "border-accent bg-[rgba(232,67,10,0.14)] text-foreground"
                    : "border-border bg-black/20 text-textSecondary hover:border-borderHover hover:text-white"
                }`}
              >
                {stage}
                <span className="rounded-full bg-surface3 px-2 py-0.5 font-mono text-xs text-muted">
                  {(byStage[stage] || []).length}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => stepStage(1)}
            disabled={activeStage === STAGES[STAGES.length - 1]}
            aria-label="Next pipeline stage"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-black/20 text-textSecondary transition-all hover:border-accent hover:text-white disabled:opacity-30"
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <p className="px-1 pt-2 text-xs leading-relaxed text-muted">
          Jump to a stage, use the arrows, swipe on touchscreens, or drag the scrollbar below the columns.
        </p>
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
                ref={(node) => {
                  stageRefs.current[stage] = node;
                }}
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
              ref={(node) => {
                stageRefs.current[stage] = node;
              }}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(c);
                            }}
                            title="Delete contact"
                            aria-label={`Delete ${f["Name / Target"] || "contact"}`}
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

      {researchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-5"
          onClick={() => setResearchOpen(false)}
        >
          <div
            className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface2 sm:rounded-2xl"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
              <div>
                <h3 className="text-xl font-bold text-foreground">Research missing emails</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                  Work the next 20 leads. Find and verify an address, then save it. That lead moves to Ready for
                  Outreach automatically; the research count drops by one.
                </p>
              </div>
              <button
                onClick={() => setResearchOpen(false)}
                aria-label="Close research queue"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-black/20 text-muted hover:border-accent hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-border bg-black/20 px-4 py-3 text-sm text-textSecondary sm:px-5">
              <span className="font-semibold text-foreground">{researchQueue.length}</span> leads still need an
              address. New blank-email leads will join this queue; moved leads do not get replaced automatically.
            </div>

            {researchError && (
              <div className="mx-4 mt-4 rounded-xl border border-[rgba(232,67,10,0.4)] bg-[rgba(232,67,10,0.1)] px-4 py-3 text-sm text-accentLight sm:mx-5">
                {researchError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
              {researchQueue.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface3 px-5 py-8 text-center">
                  <p className="font-semibold text-foreground">Every lead has an email address.</p>
                  <p className="mt-1 text-sm text-muted">Your research queue is clear.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {researchQueue.slice(0, 20).map((contact) => {
                    const fields = contact.fields;
                    const webQuery = encodeURIComponent(
                      [fields["Name / Target"], fields.Organization, fields.Role, "email"]
                        .filter(Boolean)
                        .join(" ")
                    );
                    const source = [
                      fields["Source / Research Starting Point"],
                      fields["Primary Source URL"],
                      fields.Website,
                    ].find((url) => typeof url === "string" && /^https?:\/\//i.test(url));
                    return (
                      <div
                        key={contact.id}
                        className="grid gap-3 rounded-xl border border-border bg-surface3 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(230px,0.8fr)] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{fields["Name / Target"]}</p>
                          <p className="mt-0.5 truncate text-sm text-muted">
                            {[fields.Role, fields.Organization].filter(Boolean).join(" · ") || "Research details not set"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {source && (
                              <a
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-black/20 px-3 py-2 text-xs text-textSecondary hover:border-accent hover:text-white"
                              >
                                <ExternalLink size={13} /> Open source
                              </a>
                            )}
                            <a
                              href={`https://www.google.com/search?q=${webQuery}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-black/20 px-3 py-2 text-xs text-textSecondary hover:border-accent hover:text-white"
                            >
                              <Search size={13} /> Search web
                            </a>
                          </div>
                        </div>
                        <div className="flex min-w-0 gap-2">
                          <input
                            type="email"
                            value={researchDrafts[contact.id] || ""}
                            onChange={(e) =>
                              setResearchDrafts((prev) => ({ ...prev, [contact.id]: e.target.value }))
                            }
                            onKeyDown={(e) => e.key === "Enter" && saveResearchEmail(contact)}
                            placeholder="verified@email.com"
                            aria-label={`Email for ${fields["Name / Target"] || "lead"}`}
                            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-black/30 px-3 text-base text-foreground outline-none placeholder:text-muted focus:border-accent"
                          />
                          <button
                            onClick={() => saveResearchEmail(contact)}
                            disabled={!researchDrafts[contact.id]?.trim() || researchSavingId === contact.id}
                            className="min-h-11 flex-shrink-0 rounded-lg bg-accent px-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
                          >
                            {researchSavingId === contact.id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <input
                value={detail.fields["Name / Target"] || ""}
                onChange={(e) => setDetailField({ "Name / Target": e.target.value })}
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
          name={pendingDelete.fields["Name / Target"] || ""}
          busy={saving}
          onConfirm={removeContact}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
