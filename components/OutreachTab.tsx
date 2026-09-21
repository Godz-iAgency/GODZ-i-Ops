"use client";

import { useState } from "react";
import OutreachBoard from "./OutreachBoard";
import LinkedInBoard from "./LinkedInBoard";
import BookwormOutreachBoard from "./BookwormOutreachBoard";
import BookwormTikTokBoard from "./BookwormTikTokBoard";

type Business = "SplitMic" | "Bookworm";
type Pipeline = "email" | "social";

// Each business runs the same two-channel shape: email, plus one social
// channel for the audience that actually lives there. SplitMic works
// professionals (venues, promoters) on LinkedIn; Bookworm works book and
// self-improvement creators on TikTok. The boards behind them share no data.
const PIPELINES: Record<Business, ReadonlyArray<{ id: Pipeline; label: string }>> = {
  SplitMic: [
    { id: "email", label: "Email" },
    { id: "social", label: "LinkedIn" },
  ],
  Bookworm: [
    { id: "email", label: "Email" },
    { id: "social", label: "TikTok" },
  ],
};

export default function OutreachTab() {
  const [business, setBusiness] = useState<Business>("SplitMic");
  // Remembered per business so flipping between them doesn't reset the channel.
  const [pipelineByBusiness, setPipelineByBusiness] = useState<Record<Business, Pipeline>>({
    SplitMic: "email",
    Bookworm: "email",
  });
  const pipeline = pipelineByBusiness[business];

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

        <div className="flex gap-2 bg-surface2 p-1.5 rounded-full border border-border self-start">
          {PIPELINES[business].map((p) => {
            const active = pipeline === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPipelineByBusiness((prev) => ({ ...prev, [business]: p.id }))}
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
      </div>

      {business === "SplitMic" ? (
        pipeline === "email" ? (
          <OutreachBoard />
        ) : (
          <LinkedInBoard />
        )
      ) : pipeline === "email" ? (
        <BookwormOutreachBoard />
      ) : (
        <BookwormTikTokBoard />
      )}
    </div>
  );
}
