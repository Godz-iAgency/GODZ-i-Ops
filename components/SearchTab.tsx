"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";

type Mode = "splitmic-linkedin" | "bookworm-tiktok" | "email";
type Idea = { id: number; text: string; addedAt: string };

const LINKEDIN_GROUPS = [
  { label: "Priority 1 · contact first", terms: ["Austin talent buyer", "Austin venue booking manager", "Austin concert promoter"] },
  {
    label: "Priority 2 · decision makers",
    terms: ["Austin artist manager", "Austin band manager", "Austin festival director", "Austin festival talent buyer", "Austin A&R", "Austin record label owner", "Austin live event producer"],
  },
  {
    label: "Priority 3 · ecosystem",
    terms: ["Austin music organization", "Austin music nonprofit", "Austin recording studio", "Austin rehearsal studio", "Austin backline company", "Austin instrument rental company", "Austin music entrepreneur", "Austin music journalist", "Austin music podcast", "Austin radio host"],
  },
];

const TIKTOK_GROUPS = [
  { label: "Core discovery", terms: ["#selfimprovement", "#personaldevelopment", "#selfhelp", "#bookrecommendations", "#nonfictionbooks", "#productivitytips", "#mindset", "#booktok"] },
  { label: "Search queries", terms: ["self improvement books", "personal development books", "best self help books", "productivity book recommendations"] },
];

const BOOKWORM_EMAIL_GROUPS = [
  {
    label: "Primary · business consultants",
    terms: ["Business Consultant", "Management Consultant", "Strategy Consultant", "Growth Consultant", "Leadership Consultant", "Executive Coach", "Operations Consultant", "Marketing Consultant", "Sales Consultant", "Independent Consultant", "Founder", "Principal", "Managing Partner"],
  },
  { label: "Secondary audiences", terms: ["book clubs", "libraries", "reading organizations", "authors", "book podcasts", "educational communities"] },
  { label: "Strategic partnerships · separate list", terms: ["Founders Podcast", "business book authors", "publishers", "large book communities", "book distribution partners"] },
];

const SPLITMIC_EMAIL_GROUPS = [
  {
    label: "Austin music email targets",
    terms: ["Austin music organizations", "Austin musician groups", "Austin music venues", "Austin talent buyers", "Austin concert promoters", "Austin music festivals", "Austin artist managers", "Austin record labels", "Austin recording studios", "Austin rehearsal studios", "Austin backline companies", "Austin instrument rental companies"],
  },
];

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button onClick={copy} className="flex min-h-11 w-full items-center gap-1.5 rounded-xl border px-4 py-2 text-left text-sm transition-all hover:-translate-y-0.5 min-[420px]:w-auto min-[420px]:rounded-full" style={{ background: copied ? "var(--color-accent)" : "rgba(255,255,255,0.04)", borderColor: copied ? "var(--color-accent)" : "rgba(255,255,255,0.08)", color: "#fff" }}>
      {copied && <Check size={12} strokeWidth={3} />}
      {copied ? "Copied" : text}
    </button>
  );
}
function Groups({ groups }: { groups: Array<{ label: string; terms: string[] }> }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => (
        <details key={group.label} open={index === 0} className="group rounded-2xl border border-border bg-surface2">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
            <span className="text-xs font-bold uppercase leading-relaxed tracking-[0.1em] text-foreground sm:text-sm sm:tracking-[0.12em]">{group.label}</span>
            <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-4 sm:gap-2.5 sm:px-5">
            {group.terms.map((term) => <CopyChip key={term} text={term} />)}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function SearchTab() {
  const [mode, setMode] = useState<Mode>("splitmic-linkedin");
  const [emailBusiness, setEmailBusiness] = useState<"Bookworm" | "Splitmic">("Bookworm");
  const [ideas, setIdeas] = useLocalStorage<Idea[]>("godzi-content-log", []);
  const [idea, setIdea] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const addIdea = () => {
    if (!idea.trim()) return;
    setIdeas([{ id: Date.now(), text: idea.trim(), addedAt: today }, ...ideas]);
    setIdea("");
  };

  const copy = {
    "splitmic-linkedin": { eyebrow: "Splitmic → LinkedIn", title: "Who should I contact next?", description: "Start with Priority 1. Tap a search to copy it, find one qualified person, then log the outreach.", groups: LINKEDIN_GROUPS },
    "bookworm-tiktok": { eyebrow: "Bookworm → TikTok", title: "Find the next qualified creator", description: "The research CLI uses these same configurable terms. Manual searches remain available as a fallback.", groups: TIKTOK_GROUPS },
    email: { eyebrow: "Email", title: "Find the next email prospect", description: "Routine cold outreach stays separate from strategic partnerships.", groups: emailBusiness === "Bookworm" ? BOOKWORM_EMAIL_GROUPS : SPLITMIC_EMAIL_GROUPS },
  }[mode];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 sm:gap-6">
      <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-border bg-surface2 p-1 sm:w-auto sm:self-start sm:rounded-full sm:p-1.5">
        {([["splitmic-linkedin", "Splitmic · LinkedIn"], ["bookworm-tiktok", "Bookworm · TikTok"], ["email", "Email"]] as Array<[Mode, string]>).map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} className="min-h-11 rounded-xl px-2 py-2 text-xs font-semibold sm:whitespace-nowrap sm:rounded-full sm:px-5 sm:py-2.5 sm:text-sm" style={{ background: mode === id ? "var(--color-accent)" : "transparent", color: mode === id ? "#0a0705" : "var(--color-muted)" }}>
            {id === "splitmic-linkedin" ? <><span>Splitmic</span><span className="hidden sm:inline"> · LinkedIn</span></> : id === "bookworm-tiktok" ? <><span>Bookworm</span><span className="hidden sm:inline"> · TikTok</span></> : label}
          </button>
        ))}
      </div>

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accentLight">{copy.eyebrow}</p>
        <h1 className="mt-2 text-[clamp(1.75rem,7vw,2.25rem)] font-extrabold leading-tight text-foreground">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.description}</p>
      </header>

      {mode === "email" && (
        <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-border bg-surface2 p-1 sm:w-auto sm:self-start">
          {(["Bookworm", "Splitmic"] as const).map((business) => (
            <button key={business} onClick={() => setEmailBusiness(business)} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: emailBusiness === business ? "var(--color-accent)" : "transparent", color: emailBusiness === business ? "#0a0705" : "var(--color-muted)" }}>{business}</button>
          ))}
        </div>
      )}

      <Groups groups={copy.groups} />

      <details className="group rounded-2xl border border-border bg-surface2">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-textSecondary sm:px-5 sm:py-4">Content idea scratchpad<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></summary>
        <div className="border-t border-border p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={idea} onChange={(event) => setIdea(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addIdea()} placeholder="Capture an idea" className="min-w-0 flex-1 rounded-xl border border-border bg-black/25 px-4 py-3 text-foreground outline-none placeholder:text-muted" />
            <button onClick={addIdea} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white"><Plus size={15} /> Add</button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {ideas.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-black/20 px-4 py-3">
                <span className="min-w-0 flex-[1_1_100%] break-words text-sm text-foreground min-[420px]:flex-1">{item.text}</span><span className="font-mono text-xs text-muted">{item.addedAt}</span>
                <button onClick={() => setIdeas(ideas.filter((candidate) => candidate.id !== item.id))} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5" aria-label="Delete idea"><Trash2 size={14} className="text-muted" /></button>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
