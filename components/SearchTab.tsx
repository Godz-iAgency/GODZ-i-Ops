"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";

// The daily 11:00-12:00 LinkedIn hour runs off these. Grouped the way the
// Austin music ecosystem actually breaks down, so an hour of searching covers
// one part of the scene properly instead of skimming all of it.
const LINKEDIN_SEARCH_GROUPS: Array<{ label: string; terms: string[] }> = [
  {
    label: "Venues & booking",
    terms: [
      "Austin venue owner",
      "Austin music venue owner",
      "Austin venue booking manager",
      "Austin talent buyer",
      "Austin live music booker",
    ],
  },
  {
    label: "Promoters & festivals",
    terms: [
      "Austin concert promoter",
      "Austin music promoter",
      "Austin festival director",
      "Austin festival talent buyer",
    ],
  },
  {
    label: "Artists & management",
    terms: [
      "Austin artist manager",
      "Austin band manager",
      "Austin music manager",
      "Austin musician",
      "Austin singer songwriter",
      "Austin band",
    ],
  },
  {
    label: "Labels & A&R",
    terms: ["Austin record label owner", "Austin A&R"],
  },
  {
    label: "Organizations & nonprofits",
    terms: ["Austin music organization director", "Austin music nonprofit director"],
  },
  {
    label: "Production & live events",
    terms: [
      "Austin production manager",
      "Austin live event producer",
      "Austin concert producer",
    ],
  },
  {
    label: "Studios, backline & rental",
    terms: [
      "Austin recording studio owner",
      "Austin rehearsal studio owner",
      "Austin backline company",
      "Austin instrument rental",
    ],
  },
  {
    label: "Startups & founders",
    terms: ["Austin music entrepreneur", "Austin music startup founder"],
  },
  {
    label: "Media & press",
    terms: ["Austin music journalist", "Austin music podcast", "Austin music radio host"],
  },
];

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };
  return (
    <button
      onClick={doCopy}
      className="text-sm px-4 py-2 rounded-full text-left flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
      style={{
        background: copied ? "var(--color-accent)" : "rgba(255,255,255,0.04)",
        borderColor: copied ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderStyle: "solid",
        color: "#fff",
      }}
    >
      {copied && <Check size={12} strokeWidth={3} />}
      {copied ? "Copied" : text}
    </button>
  );
}

type Idea = { id: number; text: string; addedAt: string };

export default function SearchTab() {
  const [contentLog, setContentLog] = useLocalStorage<Idea[]>("godzi-content-log", []);
  const [newContentIdea, setNewContentIdea] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const addContentIdea = () => {
    if (!newContentIdea.trim()) return;
    const id = Math.max(0, ...contentLog.map((c) => c.id)) + 1;
    setContentLog([{ id, text: newContentIdea.trim(), addedAt: today }, ...contentLog]);
    setNewContentIdea("");
  };
  const removeContentIdea = (id: number) => setContentLog(contentLog.filter((c) => c.id !== id));

  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-9">
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono">
            LinkedIn search terms · tap to copy
          </h2>
          <p className="text-sm text-muted mt-1.5">
            11:00 to 12:00. Search, pick 10 people, log them on the Outreach tab.
          </p>
        </div>
        {LINKEDIN_SEARCH_GROUPS.map((group) => (
          <div key={group.label}>
            <h3 className="text-xs uppercase tracking-[0.2em] text-accent font-bold font-mono mb-2.5">
              {group.label}
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {group.terms.map((s) => (
                <CopyChip key={s} text={s} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">Content ideas</h2>
        <div className="flex gap-2.5 mb-4">
          <input
            value={newContentIdea}
            onChange={(e) => setNewContentIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addContentIdea()}
            placeholder="What are you researching today?"
            className="flex-1 min-w-0 text-base px-4 py-3 rounded-xl outline-none bg-white/[0.02] text-foreground border border-border placeholder:text-muted"
          />
          <button
            onClick={addContentIdea}
            className="px-5 py-3 rounded-xl text-base font-bold flex items-center gap-1.5 text-white"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          >
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {contentLog.length === 0 && <p className="text-sm italic text-muted">Nothing added yet.</p>}
          {contentLog.map((idea) => (
            <div key={idea.id} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-surface2 border border-border">
              <span className="text-base flex-1 text-foreground">{idea.text}</span>
              <span className="text-xs text-muted font-mono">{idea.addedAt}</span>
              <button onClick={() => removeContentIdea(idea.id)}>
                <Trash2 size={15} color="var(--color-muted)" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
