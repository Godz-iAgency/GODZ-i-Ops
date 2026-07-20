"use client";

import { useState } from "react";
import TodayTab from "@/components/TodayTab";
import OutreachBoard from "@/components/OutreachBoard";
import SearchTab from "@/components/SearchTab";
import HundredDaysTab from "@/components/HundredDaysTab";
import LinksTab from "@/components/LinksTab";

const TABS = [
  { id: "today", label: "Today" },
  { id: "outreach", label: "Outreach" },
  { id: "hundred", label: "100 Days" },
  { id: "search", label: "Search" },
  { id: "links", label: "Links" },
];

export default function Home() {
  const [tab, setTab] = useState("today");

  return (
    <div className="relative z-[1] min-h-screen w-full">
      <header className="sticky top-0 z-20 border-b border-border backdrop-blur-md bg-[rgba(5,5,7,0.9)]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center font-black text-sm text-[#0a0705] bg-gradient-to-br from-accent to-accentLight">
              G
            </div>
            <div>
              <div className="text-[10px] tracking-[0.22em] uppercase text-accent font-bold leading-none">GODZ-i</div>
              <div className="text-[13px] text-[#b8ada1] font-semibold leading-none mt-0.5">Command Center</div>
            </div>
          </div>
          <nav className="flex gap-1.5 bg-white/[0.03] p-1 rounded-full border border-border overflow-x-auto max-w-full">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
                  style={{
                    background: active ? "var(--color-accent)" : "transparent",
                    color: active ? "#0a0705" : "var(--color-muted)",
                    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-[1160px] mx-auto px-4 sm:px-6 pt-7 pb-14 relative z-[1]">
        {tab === "today" && <TodayTab />}
        {tab === "outreach" && <OutreachBoard />}
        {tab === "hundred" && <HundredDaysTab />}
        {tab === "search" && <SearchTab />}
        {tab === "links" && <LinksTab />}
      </main>
    </div>
  );
}
