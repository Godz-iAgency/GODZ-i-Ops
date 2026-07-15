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
      className="text-xs px-2.5 py-1 rounded-full text-left flex items-center gap-1.5 border"
      style={{ background: copied ? "#F0451F" : "#1F1F1F", borderColor: copied ? "#F0451F" : "#2C2C2C", color: "#fff" }}
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
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">
          LinkedIn search terms, talent buyers · tap to copy
        </h2>
        <div className="flex flex-wrap gap-2">
          {LINKEDIN_SEARCH_TERMS.map((s) => (
            <CopyChip key={s} text={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">
          Instagram search terms, bands · tap to copy
        </h2>
        <div className="flex flex-wrap gap-2">
          {INSTAGRAM_SEARCH_TERMS.map((s) => (
            <CopyChip key={s} text={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">Content ideas</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={newContentIdea}
            onChange={(e) => setNewContentIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addContentIdea()}
            placeholder="What are you researching today?"
            className="flex-1 min-w-0 text-sm px-2.5 py-2 rounded-md outline-none bg-[#1F1F1F] text-white border border-[#2C2C2C]"
          />
          <button onClick={addContentIdea} className="px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 bg-[#F0451F] text-white">
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {contentLog.length === 0 && <p className="text-xs italic text-[#999]">Nothing added yet.</p>}
          {contentLog.map((idea) => (
            <div key={idea.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1F1F1F] border border-[#2C2C2C]">
              <span className="text-sm flex-1">{idea.text}</span>
              <span className="text-[10px] text-[#999] font-mono">{idea.addedAt}</span>
              <button onClick={() => removeContentIdea(idea.id)}>
                <Trash2 size={13} color="#999" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
