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
  { id: "search", label: "Search" },
  { id: "hundred", label: "100 Days" },
  { id: "links", label: "Links" },
];

export default function Home() {
  const [tab, setTab] = useState("today");

  return (
    <div className="min-h-screen w-full">
      <header className="px-5 pt-6 pb-4 border-b border-[#2C2C2C]">
        <nav className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border"
              style={{
                background: tab === t.id ? "#F0451F" : "#141414",
                color: tab === t.id ? "#fff" : "#999",
                borderColor: tab === t.id ? "#F0451F" : "#2C2C2C",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-5">
        {tab === "today" && <TodayTab />}
        {tab === "outreach" && <OutreachBoard />}
        {tab === "search" && <SearchTab />}
        {tab === "hundred" && <HundredDaysTab />}
        {tab === "links" && <LinksTab />}
      </main>
    </div>
  );
}
