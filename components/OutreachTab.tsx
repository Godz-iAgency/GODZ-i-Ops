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
  const channelLabel = PIPELINES[business].find((item) => item.id === pipeline)?.label || "Email";
  const workspaceDescription =
    business === "SplitMic"
      ? pipeline === "email"
        ? "Research, contact, and follow up with venues, promoters, and music-industry partners."
        : "Build professional relationships with SplitMic prospects on LinkedIn."
      : pipeline === "email"
        ? "Move Bookworm partners from research to a productive email conversation."
        : "Review and contact qualified Bookworm creators on TikTok.";

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
      <section className="rounded-2xl border border-border bg-surface2/80 p-3.5 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(460px,auto)] xl:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accentLight">Outreach workspace</p>
            <h1 className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">
              {business} <span className="text-muted">·</span> {channelLabel}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-textSecondary">{workspaceDescription}</p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-[0.12em] text-muted">Business</p>
              <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-border bg-black/25 p-1">
                {(["SplitMic", "Bookworm"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBusiness(b)}
                    aria-pressed={business === b}
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                      business === b
                        ? "bg-accent text-white shadow-[0_4px_14px_rgba(232,67,10,0.24)]"
                        : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-[0.12em] text-muted">Channel</p>
              <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-border bg-black/25 p-1">
                {PIPELINES[business].map((p) => {
                  const active = pipeline === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPipelineByBusiness((prev) => ({ ...prev, [business]: p.id }))}
                      aria-pressed={active}
                      className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                        active
                          ? "bg-accent text-white shadow-[0_4px_14px_rgba(232,67,10,0.24)]"
                          : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

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
