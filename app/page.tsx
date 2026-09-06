"use client";

import { useState } from "react";
import Image from "next/image";
import TodayTab from "@/components/TodayTab";
import OutreachTab from "@/components/OutreachTab";
import RepliesTab from "@/components/RepliesTab";
import SearchTab from "@/components/SearchTab";
import HundredDaysTab from "@/components/HundredDaysTab";
import ResourcesTab from "@/components/ResourcesTab";
import CalendarTab from "@/components/CalendarTab";

const TABS = [
  { id: "today", label: "Today" },
  { id: "outreach", label: "Outreach" },
  { id: "replies", label: "Replies" },
  { id: "hundred", label: "100 Days" },
  { id: "calendar", label: "Calendar" },
  { id: "search", label: "Search" },
  { id: "resources", label: "Resources" },
];

export default function Home() {
  const [tab, setTab] = useState("today");

  return (
    <div className="relative z-[1] min-h-screen w-full">
      <header className="sticky top-0 z-20 border-b border-border backdrop-blur-md bg-[rgba(5,5,7,0.9)]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Image src="/godzi-ops-logo.png" alt="GODZ-i" width={2000} height={600} priority className="h-11 w-auto rounded-lg" />
            <div className="text-base text-[#b8ada1] font-semibold leading-tight border-l border-border pl-4">
              Command
              <br />
              Center
            </div>
          </div>
          <nav className="flex gap-2 bg-white/[0.03] p-1.5 rounded-full border border-border overflow-x-auto max-w-full">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-full text-base font-semibold transition-all"
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

      <main className="w-full px-5 sm:px-8 pt-9 pb-16 relative z-[1]">
        {tab === "today" && <TodayTab />}
        {tab === "outreach" && <OutreachTab />}
        {tab === "replies" && <RepliesTab />}
        {tab === "hundred" && <HundredDaysTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "search" && <SearchTab />}
        {tab === "resources" && <ResourcesTab />}
      </main>
    </div>
  );
}
