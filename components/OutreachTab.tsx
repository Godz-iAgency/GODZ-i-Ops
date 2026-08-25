"use client";

import { useState } from "react";
import OutreachBoard from "./OutreachBoard";
import LinkedInBoard from "./LinkedInBoard";

// Two genuinely separate pipelines behind one tab. Email works the 500-target
// research database down to verified, sendable contacts. LinkedIn is manual
// daily prospecting that never touches those records.
const PIPELINES = [
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export default function OutreachTab() {
  const [pipeline, setPipeline] = useState<"email" | "linkedin">("email");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 bg-surface2 p-1.5 rounded-full border border-border self-start">
        {PIPELINES.map((p) => {
          const active = pipeline === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPipeline(p.id)}
              className="px-6 py-2.5 rounded-full text-base font-semibold transition-all"
              style={{
                background: active ? "var(--color-accent)" : "transparent",
                color: active ? "#0a0705" : "var(--color-muted)",
                boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {pipeline === "email" ? <OutreachBoard /> : <LinkedInBoard />}
    </div>
  );
}
