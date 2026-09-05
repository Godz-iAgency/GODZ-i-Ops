"use client";

import { austinDateStr, austinDayOfWeek } from "@/lib/austinDate";
import { dayNumber, sprintStartLabel } from "@/lib/sprint";
import { Save, Check, Minus, Plus, RefreshCw, ExternalLink, ChevronDown, ChevronUp, X, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Progress = {
  Date?: string;
  "Day Number"?: number;
  Weekday?: string;
  "Emails Sent"?: number;
  "LinkedIn Sent"?: number;
  "Build Objective"?: string;
  "Build Completed"?: boolean;
  "Build Notes"?: string;
  "Deliver Completed"?: boolean;
  "Feedback Received"?: string;
  "Needs Follow-up"?: string;
  "Deliver Next Action"?: string;
  "Camera Practice"?: boolean;
  "Content Posted"?: boolean;
  "Content Platform"?: string;
  "Content Title"?: string;
  "Content URL"?: string;
  Book?: string;
  "Pages or Chapter"?: string;
  Learned?: string;
  Apply?: string;
  "Deep Work Completed"?: boolean;
  "Deep Work Notes"?: string;
};

type Contact = {
  id: string;
  fields: {
    "Name / Target"?: string;
    Organization?: string;
    Role?: string;
    Category?: string;
    Priority?: number;
    Email?: string;
    "Email Status"?: string;
    "LinkedIn URL"?: string;
    "Why They Matter to SplitMic"?: string;
    "Source / Research Starting Point"?: string;
    "Verification Status"?: string;
    Notes?: string;
  };
};

const PLATFORMS = ["LinkedIn", "Instagram", "TikTok", "YouTube", "X", "Facebook", "Other"];

const emptyProgress: Progress = {
  "Emails Sent": 0,
  "LinkedIn Sent": 0,
  "Build Objective": "",
  "Build Completed": false,
  "Build Notes": "",
  "Deliver Completed": false,
  "Feedback Received": "",
  "Needs Follow-up": "",
  "Deliver Next Action": "",
  "Camera Practice": false,
  "Content Posted": false,
  "Content Platform": "",
  "Content Title": "",
  "Content URL": "",
  Book: "",
  "Pages or Chapter": "",
  Learned: "",
  Apply: "",
  "Deep Work Completed": false,
  "Deep Work Notes": "",
};

const input =
  "w-full text-base px-4 py-3 rounded-xl outline-none bg-black/30 text-foreground border border-border placeholder:text-muted";
const area = input + " resize-none";

function Block({
  tag,
  time,
  title,
  children,
}: {
  tag: string;
  time: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 flex-wrap mb-3.5">
        <span
          className="text-xs font-bold font-mono tracking-[0.16em] px-2.5 py-1 rounded-full"
          style={{ background: "rgba(232,67,10,0.14)", color: "var(--color-accent-light)" }}
        >
          {tag}
        </span>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono">{time}</h2>
      </div>
      <h3 className="text-lg font-bold text-foreground mb-3">{title}</h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Counter({ count, onChange, goal }: { count: number; onChange: (n: number) => void; goal: number }) {
  const done = count >= goal;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        border: `1px solid ${done ? "rgba(232,67,10,0.4)" : "var(--color-border)"}`,
        background: done ? "rgba(232,67,10,0.1)" : "rgba(255,255,255,0.02)",
      }}
    >
      <span className="flex-1 text-base font-mono" style={{ color: done ? "#f2ece5" : "var(--color-muted)" }}>
        {count} / {goal}
      </span>
      <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-black/30 border border-border">
        <button
          onClick={() => onChange(Math.max(0, count - 1))}
          aria-label="Decrease"
          className="w-9 h-9 rounded-full flex items-center justify-center text-textSecondary hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <Minus size={15} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={count}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange(digits === "" ? 0 : parseInt(digits, 10));
          }}
          className="w-10 text-center text-base font-bold bg-transparent outline-none text-foreground font-mono"
        />
        <button
          onClick={() => onChange(count + 1)}
          aria-label="Increase"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90"
          style={{ background: "var(--color-accent)" }}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className="row-hover w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-base text-left"
      style={{
        border: `1px solid ${checked ? "rgba(232,67,10,0.4)" : "var(--color-border)"}`,
        background: checked ? "rgba(232,67,10,0.1)" : "rgba(255,255,255,0.02)",
        color: checked ? "#f2ece5" : "var(--color-muted)",
      }}
    >
      <span
        className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center"
        style={{
          border: `1.5px solid ${checked ? "var(--color-accent)" : "rgba(255,255,255,0.25)"}`,
          background: checked ? "var(--color-accent)" : "transparent",
        }}
      >
        {checked && <Check size={14} color="#fff" strokeWidth={3.5} />}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

// TODAY'S 10: who to email today. Nothing is sent automatically -- each one is
function SendPanel({ contact, onSent }: { contact: Contact; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setSent(`Sent. ${data.sentToday}/${data.limit} today.`);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <p className="text-sm text-center py-2 text-accentLight font-mono">{sent}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 bg-black/30 border border-border text-foreground hover:border-accent transition-all"
      >
        <Send size={14} /> Write and send from the app
      </button>
    );
  }

  const ready = subject.trim() && bodyText.trim();

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-black/30 border border-border">
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full text-sm px-3 py-2.5 rounded-lg outline-none bg-surface2 text-foreground border border-border placeholder:text-muted"
      />
      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder={`Hi ${(contact.fields["Name / Target"] || "").split(" ")[0] || "there"},`}
        rows={7}
        className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none bg-surface2 text-foreground border border-border placeholder:text-muted"
      />
      <p className="text-xs text-muted leading-relaxed">
        Your signature, postal address and an unsubscribe link are added automatically.
      </p>
      {error && <p className="text-xs text-accentLight">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 rounded-lg text-sm bg-surface2 border border-border text-textSecondary"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={!ready || sending}
          className="flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 transition-all"
          style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
        >
          <Send size={14} /> {sending ? "Sending…" : `Send to ${contact.fields.Email}`}
        </button>
      </div>
    </div>
  );
}

// Quick entry for the gap Today's 10 exists to protect against: a target with
// no email is worthless to the queue no matter how well-researched otherwise.
// This lets an address be typed in right where the problem is surfaced,
// instead of sending someone hunting through the Outreach board for it.
function NeedsEmailPanel({ count, onFilled }: { count: number; onFilled: () => void }) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/needs-email?limit=20");
      if (!res.ok) throw new Error("Could not load targets");
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    setOpen(true);
    if (contacts.length === 0) load();
  };

  const save = async (id: string) => {
    const email = (drafts[id] || "").trim();
    if (!email) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email }),
      });
      if (!res.ok) throw new Error("Could not save");
      setContacts((prev) => prev.filter((c) => c.id !== id));
      onFilled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingId(null);
    }
  };

  if (count === 0) return null;

  if (!open) {
    return (
      <button
        onClick={openPanel}
        className="w-full text-left px-4 py-3 rounded-xl bg-surface3 border border-border hover:border-accent transition-all"
      >
        <p className="text-sm text-foreground">
          <span className="font-semibold">{count} targets</span> still need an email address.{" "}
          <span className="text-accentLight">Add them now →</span>
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-surface3 border border-border p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.1em] text-muted font-mono">Add missing emails</p>
        <button onClick={() => setOpen(false)}>
          <X size={15} color="var(--color-muted)" />
        </button>
      </div>

      {error && <p className="text-xs text-accentLight">{error}</p>}
      {loading && <p className="text-sm italic text-muted px-1">Loading…</p>}

      {!loading && contacts.length === 0 && (
        <p className="text-sm text-muted px-1">All caught up here for now — refresh Today's 10 to see more.</p>
      )}

      {contacts.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{c.fields["Name / Target"]}</p>
            <p className="text-xs text-muted truncate">
              {[c.fields.Role, c.fields.Organization].filter(Boolean).join(" · ")}
            </p>
          </div>
          <input
            value={drafts[c.id] || ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && save(c.id)}
            placeholder="email@address.com"
            className="w-48 flex-shrink-0 text-sm px-3 py-2 rounded-lg outline-none bg-black/30 text-foreground border border-border placeholder:text-muted"
          />
          <button
            onClick={() => save(c.id)}
            disabled={!drafts[c.id]?.trim() || savingId === c.id}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          >
            <Check size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// opened, written by hand, then marked off here. Only contacts with a real
// email address qualify; research targets stay out of this list by design.
function TodaysTen({ onSentChange }: { onSentChange: (delta: number) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [researchNeeded, setResearchNeeded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/today?limit=10");
      if (!res.ok) throw new Error("Could not load today's contacts");
      const data = await res.json();
      setContacts(data.contacts);
      setResearchNeeded(data.researchNeeded ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markSent = async (c: Contact) => {
    setSaving(c.id);
    try {
      const res = await fetch(`/api/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "Email Status": "Sent",
          "Email Last Contacted": austinDateStr(),
          "Relationship Status": "Contacted",
        }),
      });
      if (!res.ok) throw new Error("Could not save");
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      setOpenId(null);
      onSentChange(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm uppercase tracking-[0.14em] text-muted font-mono">
          Today&apos;s 10 · next up in the SplitMic 500
        </h4>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}
      {loading && <p className="text-sm italic text-muted px-1">Loading…</p>}
      {!loading && contacts.length === 0 && !error && (
        <div className="px-4 py-4 rounded-xl bg-surface2 border border-border">
          <p className="text-base font-semibold text-foreground mb-1">Nobody is ready to email yet.</p>
          <p className="text-sm text-muted leading-relaxed">
            {researchNeeded > 0
              ? "Add an email address below and they'll queue up here."
              : "Everyone with an address has already been contacted."}
          </p>
        </div>
      )}
      <NeedsEmailPanel count={researchNeeded} onFilled={() => setResearchNeeded((n) => Math.max(0, n - 1))} />

      {contacts.map((c) => {
        const f = c.fields;
        const open = openId === c.id;
        return (
          <div key={c.id} className="rounded-xl bg-surface3 border border-border overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : c.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{f["Name / Target"]}</p>
                <p className="text-sm text-muted truncate">
                  {[f.Role, f.Organization].filter(Boolean).join(" · ")}
                </p>
              </div>
              {f.Priority ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceElevated text-accentLight font-mono flex-shrink-0">
                  P{f.Priority}
                </span>
              ) : null}
              {open ? (
                <ChevronUp size={16} color="var(--color-muted)" />
              ) : (
                <ChevronDown size={16} color="var(--color-muted)" />
              )}
            </button>

            {open && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border pt-3.5">
                {f.Category && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceElevated text-textSecondary self-start">
                    {f.Category}
                  </span>
                )}
                {f["Why They Matter to SplitMic"] && (
                  <p className="text-sm text-textSecondary leading-relaxed">
                    {f["Why They Matter to SplitMic"]}
                  </p>
                )}
                {f["Verification Status"] && (
                  <p className="text-xs text-muted font-mono">{f["Verification Status"]}</p>
                )}

                <div className="flex flex-col gap-2">
                  {f.Email ? (
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(f.Email)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm bg-black/30 border border-border text-foreground hover:border-accent transition-all"
                    >
                      <ExternalLink size={14} /> Compose to {f.Email}
                    </a>
                  ) : (
                    <p className="text-sm text-muted px-1">
                      No email on file yet. Research it, then add it on the Outreach tab.
                    </p>
                  )}
                  {f["Source / Research Starting Point"] && (
                    <a
                      href={f["Source / Research Starting Point"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                    >
                      <ExternalLink size={14} /> Research starting point
                    </a>
                  )}
                  {f["LinkedIn URL"] && (
                    <a
                      href={f["LinkedIn URL"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm bg-black/30 border border-border text-textSecondary hover:border-accent transition-all"
                    >
                      <ExternalLink size={14} /> LinkedIn profile
                    </a>
                  )}
                </div>

                {f.Email && (
                  <SendPanel
                    contact={c}
                    onSent={() => {
                      setContacts((prev) => prev.filter((x) => x.id !== c.id));
                      setOpenId(null);
                      onSentChange(1);
                    }}
                  />
                )}

                <button
                  onClick={() => markSent(c)}
                  disabled={saving === c.id}
                  className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
                >
                  <Check size={15} /> Mark email sent
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// LinkedIn is manual prospecting, so the count comes from what actually got
// logged today rather than a tally the user has to remember to click.
function LinkedInToday({ onCountChange }: { onCountChange: (n: number) => void }) {
  const today = austinDateStr();
  const [entries, setEntries] = useState<Array<{ id: string; fields: Record<string, string> }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ Name: "", Organization: "", Role: "", "LinkedIn URL": "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/linkedin");
      if (!res.ok) throw new Error("Could not load LinkedIn prospects");
      const data = await res.json();
      const todays = (data.prospects || []).filter(
        (p: { fields: Record<string, string> }) => p.fields["Date Contacted"] === today
      );
      setEntries(todays);
      onCountChange(todays.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
    // onCountChange is a fresh closure each render; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!form.Name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, "Date Contacted": today, Status: "Contacted" }),
      });
      if (!res.ok) throw new Error("Could not save prospect");
      const created = await res.json();
      const next = [created, ...entries];
      setEntries(next);
      onCountChange(next.length);
      setForm({ Name: "", Organization: "", Role: "", "LinkedIn URL": "" });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const count = entries.length;
  const done = count >= 10;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          border: `1px solid ${done ? "rgba(232,67,10,0.4)" : "var(--color-border)"}`,
          background: done ? "rgba(232,67,10,0.1)" : "rgba(255,255,255,0.02)",
        }}
      >
        <span className="flex-1 text-base font-mono" style={{ color: done ? "#f2ece5" : "var(--color-muted)" }}>
          {loading ? "…" : count} / 10
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white transition-all"
          style={{ background: "var(--color-accent)" }}
        >
          <Plus size={14} /> Log prospect
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      {open && (
        <div className="rounded-xl p-4 bg-surface3 border border-border flex flex-col gap-2.5">
          <input
            autoFocus
            value={form.Name}
            onChange={(e) => setForm({ ...form, Name: e.target.value })}
            placeholder="Name"
            className={input}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              value={form.Organization}
              onChange={(e) => setForm({ ...form, Organization: e.target.value })}
              placeholder="Organization"
              className={input}
            />
            <input
              value={form.Role}
              onChange={(e) => setForm({ ...form, Role: e.target.value })}
              placeholder="Role"
              className={input}
            />
          </div>
          <input
            value={form["LinkedIn URL"]}
            onChange={(e) => setForm({ ...form, "LinkedIn URL": e.target.value })}
            placeholder="LinkedIn URL"
            className={input}
          />
          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={saving}
              className="flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
            >
              <Save size={14} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setOpen(false)} className="px-4 py-3 rounded-lg bg-surface2">
              <X size={15} color="var(--color-muted)" />
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface3 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{e.fields.Name}</p>
                <p className="text-xs text-muted truncate">
                  {[e.fields.Role, e.fields.Organization].filter(Boolean).join(" · ")}
                </p>
              </div>
              {e.fields["LinkedIn URL"] && (
                <a href={e.fields["LinkedIn URL"]} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} color="var(--color-muted)" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TodayTab() {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = austinDateStr();
  const day = dayNumber();
  const dow = austinDayOfWeek();
  const isSunday = dow === 0;
  const isSaturday = dow === 6;
  const weekday = new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/progress?date=${today}`);
        if (!res.ok) throw new Error("Could not load today");
        const data = await res.json();
        if (data.progress) setProgress({ ...emptyProgress, ...data.progress });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load today");
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  const set = (patch: Partial<Progress>) => setProgress((p) => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...progress, Date: today, "Day Number": day, Weekday: weekday }),
      });
      if (!res.ok) throw new Error("Could not save");
      setSavedAt(
        new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const header = day < 1 ? `SPRINT STARTS ${sprintStartLabel()}` : `DAY ${Math.min(day, 100)} OF 100`;
  const schedule = isSunday
    ? "Rest day · nothing tracked"
    : isSaturday
      ? "4:00 AM - 4:00 PM · Deep work"
      : "12:00 PM - 4:00 PM · Monday to Friday";

  return (
    <div className="flex flex-col gap-9 max-w-[900px] mx-auto">
      <div>
        <p className="text-sm tracking-[0.3em] uppercase text-accent font-bold font-mono mb-2">
          SplitMic / Command Center
        </p>
        <h1 className="text-[44px] sm:text-[56px] font-extrabold tracking-[-0.03em] leading-none text-foreground">
          {header}
        </h1>
        <p className="text-base text-muted font-mono mt-3">
          {weekday} · {schedule}
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}
      {loading && <p className="text-base italic text-muted">Loading today…</p>}

      {!loading && isSunday && (
        <div className="px-6 py-10 rounded-2xl bg-surface2 border border-border text-center">
          <p className="text-2xl font-bold text-foreground mb-2">Rest.</p>
          <p className="text-base text-muted">No outreach, building, content, or reading today.</p>
        </div>
      )}

      {!loading && isSaturday && (
        <>
          <Block tag="DEEP WORK" time="4:00 AM - 4:00 PM" title="Saturday Deep Work">
            <CheckRow
              label="Deep work session completed"
              checked={!!progress["Deep Work Completed"]}
              onToggle={() => set({ "Deep Work Completed": !progress["Deep Work Completed"] })}
            />
            <textarea
              value={progress["Deep Work Notes"] || ""}
              onChange={(e) => set({ "Deep Work Notes": e.target.value })}
              placeholder="What did you work on? Product, testing, research, feedback, next week's prep…"
              rows={5}
              className={area}
            />
          </Block>
          <SaveBar saving={saving} savedAt={savedAt} onSave={save} />
        </>
      )}

      {!loading && !isSunday && !isSaturday && (
        <>
          <Block tag="PROMOTE" time="12:00 PM - 12:40 PM" title="Email Outreach">
            <Counter
              count={progress["Emails Sent"] ?? 0}
              goal={10}
              onChange={(n) => set({ "Emails Sent": n })}
            />
            <p className="text-sm text-muted px-1">Goal: 10 SplitMic 500 contacts</p>
            <div className="mt-2">
              <TodaysTen onSentChange={(d) => set({ "Emails Sent": (progress["Emails Sent"] ?? 0) + d })} />
            </div>
          </Block>

          <Block tag="PROMOTE" time="12:40 PM - 1:20 PM" title="LinkedIn Outreach">
            <LinkedInToday onCountChange={(n) => set({ "LinkedIn Sent": n })} />
            <p className="text-sm text-muted px-1">
              Goal: 10 LinkedIn connections or outreach attempts. Search using the terms on the Search tab,
              then log each person here. The count updates itself.
            </p>
          </Block>

          <Block tag="BUILD" time="1:20 PM - 2:00 PM" title="Today's Highest-Priority SplitMic Build">
            <input
              value={progress["Build Objective"] || ""}
              onChange={(e) => set({ "Build Objective": e.target.value })}
              placeholder="Today's one objective"
              className={input}
            />
            <CheckRow
              label="Build session completed"
              checked={!!progress["Build Completed"]}
              onToggle={() => set({ "Build Completed": !progress["Build Completed"] })}
            />
            <textarea
              value={progress["Build Notes"] || ""}
              onChange={(e) => set({ "Build Notes": e.target.value })}
              placeholder="What did you build?"
              rows={3}
              className={area}
            />
          </Block>

          <Block tag="DELIVER" time="2:00 PM - 2:40 PM" title="Replies, Follow-ups and Feedback">
            <CheckRow
              label="Delivery session completed"
              checked={!!progress["Deliver Completed"]}
              onToggle={() => set({ "Deliver Completed": !progress["Deliver Completed"] })}
            />
            <textarea
              value={progress["Feedback Received"] || ""}
              onChange={(e) => set({ "Feedback Received": e.target.value })}
              placeholder="What feedback or insight did you receive today?"
              rows={3}
              className={area}
            />
            <textarea
              value={progress["Needs Follow-up"] || ""}
              onChange={(e) => set({ "Needs Follow-up": e.target.value })}
              placeholder="Who needs a follow-up?"
              rows={2}
              className={area}
            />
            <input
              value={progress["Deliver Next Action"] || ""}
              onChange={(e) => set({ "Deliver Next Action": e.target.value })}
              placeholder="Next action"
              className={input}
            />
          </Block>

          <Block tag="PROMOTE" time="2:40 PM - 3:20 PM" title="Camera Practice and Content">
            <CheckRow
              label="Camera practice completed"
              checked={!!progress["Camera Practice"]}
              onToggle={() => set({ "Camera Practice": !progress["Camera Practice"] })}
            />
            <CheckRow
              label="Content posted"
              checked={!!progress["Content Posted"]}
              onToggle={() => set({ "Content Posted": !progress["Content Posted"] })}
            />
            <select
              value={progress["Content Platform"] || ""}
              onChange={(e) => set({ "Content Platform": e.target.value })}
              className={input}
            >
              <option value="">Platform…</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              value={progress["Content Title"] || ""}
              onChange={(e) => set({ "Content Title": e.target.value })}
              placeholder="Post title or topic"
              className={input}
            />
            <input
              value={progress["Content URL"] || ""}
              onChange={(e) => set({ "Content URL": e.target.value })}
              placeholder="Link (optional)"
              className={input}
            />
          </Block>

          <Block tag="LEARN" time="3:20 PM - 4:00 PM" title="Reading">
            <input
              value={progress.Book || ""}
              onChange={(e) => set({ Book: e.target.value })}
              placeholder="Book"
              className={input}
            />
            <input
              value={progress["Pages or Chapter"] || ""}
              onChange={(e) => set({ "Pages or Chapter": e.target.value })}
              placeholder="Pages or chapter"
              className={input}
            />
            <textarea
              value={progress.Learned || ""}
              onChange={(e) => set({ Learned: e.target.value })}
              placeholder="One thing I learned"
              rows={2}
              className={area}
            />
            <textarea
              value={progress.Apply || ""}
              onChange={(e) => set({ Apply: e.target.value })}
              placeholder="One thing I can apply"
              rows={2}
              className={area}
            />
          </Block>

          <SaveBar saving={saving} savedAt={savedAt} onSave={save} />
        </>
      )}
    </div>
  );
}

function SaveBar({ saving, savedAt, onSave }: { saving: boolean; savedAt: string | null; onSave: () => void }) {
  return (
    <div>
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
          boxShadow: "var(--shadow-cta)",
        }}
      >
        <Save size={19} /> {saving ? "Saving…" : "Save today"}
      </button>
      {savedAt && <p className="text-sm text-center text-muted mt-2">Saved at {savedAt}</p>}
    </div>
  );
}
