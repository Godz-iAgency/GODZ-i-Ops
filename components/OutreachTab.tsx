"use client";

import { useEffect, useState } from "react";
import OutreachBoard from "./OutreachBoard";
import LinkedInBoard from "./LinkedInBoard";
import BookwormOutreachBoard from "./BookwormOutreachBoard";
import QualifiedTikTokBoard from "./QualifiedTikTokBoard";

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedBusiness = params.get("business");
    const requestedPipeline = params.get("pipeline");
    if (requestedBusiness === "SplitMic" || requestedBusiness === "Bookworm") {
      setBusiness(requestedBusiness);
      if (requestedPipeline === "email" || requestedPipeline === "social") {
        setPipelineByBusiness((current) => ({ ...current, [requestedBusiness]: requestedPipeline }));
      }
    }
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-border bg-surface2 p-1 sm:w-auto">
          {(["SplitMic", "Bookworm"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBusiness(b)}
              className="rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:px-5 sm:text-base"
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

        <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-border bg-surface2 p-1 sm:w-auto sm:gap-2 sm:p-1.5">
          {PIPELINES[business].map((p) => {
            const active = pipeline === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPipelineByBusiness((prev) => ({ ...prev, [business]: p.id }))}
                className="rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:px-6 sm:text-base"
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
        <QualifiedTikTokBoard />
      )}
    </div>
  );
}
