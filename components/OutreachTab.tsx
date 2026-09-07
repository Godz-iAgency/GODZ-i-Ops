"use client";

import { useState } from "react";
import OutreachBoard from "./OutreachBoard";
import LinkedInBoard from "./LinkedInBoard";
import BookwormOutreachBoard from "./BookwormOutreachBoard";

// Two genuinely separate pipelines behind SplitMic's side of this tab. Email
// works the 500-target research database down to verified, sendable
// contacts. LinkedIn is manual daily prospecting that never touches those
// records. Bookworm has no such split -- one short list, one board.
const PIPELINES = [
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export default function OutreachTab() {
  const [business, setBusiness] = useState<"SplitMic" | "Bookworm">("SplitMic");
  const [pipeline, setPipeline] = useState<"email" | "linkedin">("email");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-surface2 p-1 rounded-full border border-border self-start">
          {(["SplitMic", "Bookworm"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBusiness(b)}
              className="px-5 py-2.5 rounded-full text-base font-semibold transition-all"
              style={{
                background: business === b ? "var(--color-accent)" : "transparent",
                color: business === b ? "#0a0705" : "var(--color-muted)",
                boxShadow: business === b ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
              }}
            >
              {b}
            </button>
          ))}
        </div>

        {business === "SplitMic" && (
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
        )}
      </div>

      {business === "SplitMic" ? (
        pipeline === "email" ? (
          <OutreachBoard />
        ) : (
          <LinkedInBoard />
        )
      ) : (
        <BookwormOutreachBoard />
      )}
    </div>
  );
}
