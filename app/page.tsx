"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Bot,
  CalendarDays,
  Ellipsis,
  Home as HomeIcon,
  Library,
  Megaphone,
  MessageSquareText,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import TodayTab from "@/components/TodayTab";
import OutreachTab from "@/components/OutreachTab";
import RepliesTab from "@/components/RepliesTab";
import SearchTab from "@/components/SearchTab";
import ResourcesTab from "@/components/ResourcesTab";
import CalendarTab from "@/components/CalendarTab";
import AssistantTab from "@/components/AssistantTab";

const PRIMARY_TABS = [
  { id: "today", label: "Today", icon: HomeIcon },
  { id: "outreach", label: "Outreach", icon: Megaphone },
  { id: "assistant", label: "Assistant", icon: Bot },
  { id: "search", label: "Search", icon: Search },
];

const SECONDARY_TABS = [
  { id: "replies", label: "Replies", icon: MessageSquareText },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "resources", label: "Resources", icon: Library },
];

const TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

export default function Home() {
  const [tab, setTab] = useState("today");
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && TABS.some((item) => item.id === requested)) setTab(requested);
    setReady(true);
  }, []);

  const selectTab = (id: string) => {
    setTab(id);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="relative z-[1] min-h-screen w-full">
      <header className="sticky top-0 z-20 border-b border-border bg-[rgba(5,5,7,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center justify-between gap-4 px-3 py-3 sm:px-6 md:px-8 lg:min-h-[76px] lg:px-10">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Image src="/godzi-ops-logo.png" alt="GODZ-i" width={2000} height={600} priority className="h-8 w-auto max-w-[150px] rounded-md sm:h-10 lg:h-11 lg:max-w-none lg:rounded-lg" />
            <div className="hidden border-l border-border pl-3 text-sm font-semibold leading-tight text-[#b8ada1] min-[390px]:block sm:pl-4 sm:text-base">
              Command
              <br />
              Center
            </div>
          </div>
          <nav className="scrollbar-none hidden max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-white/[0.03] p-1.5 lg:flex lg:gap-2" aria-label="Primary navigation">
            {PRIMARY_TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon as LucideIcon;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2.5 text-sm font-semibold transition-all xl:px-5 xl:text-base"
                  style={{
                    background: active ? "var(--color-accent)" : "transparent",
                    color: active ? "#0a0705" : "var(--color-muted)",
                    boxShadow: active ? "0 4px 16px rgba(232,67,10,0.35)" : "none",
                  }}
                >
                  <Icon size={16} className="hidden xl:block" />
                  {t.label}
                </button>
              );
            })}
            <select
              aria-label="More sections"
              value={SECONDARY_TABS.some((item) => item.id === tab) ? tab : ""}
              onChange={(event) => selectTab(event.target.value)}
              className="flex-shrink-0 rounded-full bg-transparent px-3 py-2.5 text-sm font-semibold text-muted outline-none xl:px-4 xl:text-base"
            >
              <option value="" disabled>More</option>
              {SECONDARY_TABS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </nav>
        </div>
      </header>

      {/* No z-index here: it would trap the fixed z-50 modals below the sticky z-20 header. */}
      <main className="relative mx-auto w-full max-w-[1440px] px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 min-[390px]:px-4 sm:px-6 sm:pt-7 md:px-8 md:pt-9 lg:px-10 lg:pb-16">
        {!ready ? (
          <div className="mx-auto flex max-w-[960px] animate-pulse flex-col gap-4" aria-label="Loading section">
            <div className="h-9 w-52 rounded-xl bg-white/[0.045]" />
            <div className="h-24 rounded-2xl bg-white/[0.035]" />
            <div className="h-64 rounded-2xl bg-white/[0.035]" />
          </div>
        ) : (
          <>
            {tab === "today" && <TodayTab />}
            {tab === "outreach" && <OutreachTab />}
            {tab === "replies" && <RepliesTab />}
            {tab === "calendar" && <CalendarTab />}
            {tab === "assistant" && <AssistantTab />}
            {tab === "search" && <SearchTab />}
            {tab === "resources" && <ResourcesTab />}
          </>
        )}
      </main>

      {mobileMenuOpen && (
        <>
          <button
            aria-label="Close more sections"
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-border bg-surfaceElevated p-2 shadow-[0_24px_80px_rgba(0,0,0,0.75)] lg:hidden">
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted">More sections</p>
              <button onClick={() => setMobileMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SECONDARY_TABS.map((item) => {
                const Icon = item.icon as LucideIcon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectTab(item.id)}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold"
                    style={{
                      background: active ? "rgba(232,67,10,0.16)" : "rgba(255,255,255,0.025)",
                      borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                      color: active ? "var(--color-accent-light)" : "var(--color-text-secondary)",
                    }}
                  >
                    <Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-[rgba(8,8,13,0.96)] px-1 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        {PRIMARY_TABS.map((item) => {
          const Icon = item.icon as LucideIcon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectTab(item.id)}
              className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors"
              style={{ color: active ? "var(--color-accent-light)" : "var(--color-muted)" }}
            >
              <span className={active ? "flex h-7 w-10 items-center justify-center rounded-full bg-accent/[0.15]" : "flex h-7 w-10 items-center justify-center"}>
                <Icon size={19} strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors"
          style={{ color: mobileMenuOpen || SECONDARY_TABS.some((item) => item.id === tab) ? "var(--color-accent-light)" : "var(--color-muted)" }}
        >
          <span className={mobileMenuOpen || SECONDARY_TABS.some((item) => item.id === tab) ? "flex h-7 w-10 items-center justify-center rounded-full bg-accent/[0.15]" : "flex h-7 w-10 items-center justify-center"}>
            <Ellipsis size={20} />
          </span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
