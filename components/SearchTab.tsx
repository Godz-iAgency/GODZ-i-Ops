"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";

const INSTAGRAM_SEARCH_TERMS = [
  "Austin indie rock band", "Austin americana band", "Austin texas country band", "Austin blues rock band",
  "Austin folk band", "Austin singer songwriter", "Austin punk band", "Austin hardcore band",
  "Austin metal band", "Austin hip hop artist", "Austin r&b artist", "Austin soul band",
  "Austin funk band", "Austin jazz band", "Austin latin band", "Austin tejano band",
  "Austin reggae band", "Austin ska band", "Austin electronic dj", "Austin synthpop band",
];

const LINKEDIN_SEARCH_TERMS = [
  "Austin talent buyer", "Austin venue booking manager", "Austin live music booker", "Austin club talent buyer",
  "Austin concert booking agent", "Austin entertainment booker", "Austin nightclub talent buyer", "Austin bar entertainment manager",
  "Austin music venue manager", "Austin event booking coordinator", "Austin live entertainment buyer", "Austin performance venue manager",
  "Austin show booker", "Austin artist booking manager", "Austin concert venue booker", "Austin music hall booking manager",
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
      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">
          LinkedIn search terms, talent buyers · tap to copy
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {LINKEDIN_SEARCH_TERMS.map((s) => (
            <CopyChip key={s} text={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">
          Instagram search terms, bands · tap to copy
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {INSTAGRAM_SEARCH_TERMS.map((s) => (
            <CopyChip key={s} text={s} />
          ))}
        </div>
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
