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
    <div className="mx-auto flex max-w-[960px] flex-col gap-5">
      <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-border bg-surface2 p-1 sm:w-auto sm:self-start sm:gap-2 sm:p-1.5">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="min-h-11 rounded-full px-3 py-2.5 text-sm font-semibold transition-all sm:whitespace-nowrap sm:px-5 sm:text-base"
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
