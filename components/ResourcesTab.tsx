"use client";

import { useState } from "react";
import LinksTab from "./LinksTab";
import HubsBoard from "./HubsBoard";

const SECTIONS = [
  { id: "links", label: "Quick Links" },
  { id: "hubs", label: "Austin Music Hubs" },
] as const;

export default function ResourcesTab() {
  const [section, setSection] = useState<"links" | "hubs">("links");

  return (
    <div className="flex flex-col gap-5 max-w-[900px] mx-auto">
      <div className="flex gap-2 bg-surface2 p-1.5 rounded-full border border-border self-start">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="px-5 py-2.5 rounded-full text-base font-semibold transition-all whitespace-nowrap"
              style={{
                background: active ? "var(--color-accent)" : "transparent",
                color: active ? "#0a0705" : "var(--color-muted)",
                boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "links" ? <LinksTab /> : <HubsBoard />}
    </div>
  );
}
