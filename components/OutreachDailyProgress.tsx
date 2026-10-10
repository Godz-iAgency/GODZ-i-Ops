"use client";

import { useEffect, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import {
  DailyOutreachProgress,
  type OutreachBusiness,
  type OutreachCounts,
  type OutreachTargets,
} from "./OutreachProgress";

const defaultTargets: OutreachTargets = {
  splitmicLinkedIn: 10,
  splitmicEmail: 5,
  bookwormTikTok: 10,
  bookwormEmail: 5,
  splitmicCalls: 5,
  bookwormCalls: 5,
};

const emptyCounts: OutreachCounts = {
  splitmicLinkedIn: 0,
  splitmicEmail: 0,
  bookwormTikTok: 0,
  bookwormEmail: 0,
  splitmicCalls: 0,
  bookwormCalls: 0,
};

export default function OutreachDailyProgress({ business }: { business: OutreachBusiness }) {
  const [counts, setCounts] = useState<OutreachCounts>(emptyCounts);
  const [targets, setTargets] = useState<OutreachTargets>(defaultTargets);

  useEffect(() => {
    const today = austinDateStr();
    let active = true;

    (async () => {
      try {
        const [progressResponse, settingsResponse, linkedInResponse, tiktokResponse] = await Promise.all([
          fetch(`/api/progress?date=${today}`),
          fetch("/api/settings"),
          fetch("/api/linkedin"),
          fetch("/api/bookworm-tiktok"),
        ]);
        const [progressData, settingsData, linkedInData, tiktokData] = await Promise.all([
          progressResponse.ok ? progressResponse.json() : Promise.resolve({}),
          settingsResponse.ok ? settingsResponse.json() : Promise.resolve({}),
          linkedInResponse.ok ? linkedInResponse.json() : Promise.resolve({}),
          tiktokResponse.ok ? tiktokResponse.json() : Promise.resolve({}),
        ]);
        if (!active) return;

        const progress = progressData.progress || {};
        const settings = settingsData.settings || {};
        setCounts({
          splitmicLinkedIn: (linkedInData.prospects || []).filter(
            (item: { fields?: Record<string, string> }) => item.fields?.["Date Contacted"] === today
          ).length,
          splitmicEmail: Number(progress["Emails Sent"] || 0),
          bookwormTikTok: (tiktokData.creators || []).filter(
            (item: { fields?: Record<string, string> }) => item.fields?.["Date Contacted"] === today
          ).length,
          bookwormEmail: Number(progress["Bookworm Emails Sent"] || 0),
          splitmicCalls: Number(progress["SplitMic Calls Made"] || 0),
          bookwormCalls: Number(progress["Bookworm Calls Made"] || 0),
        });
        setTargets({
          splitmicLinkedIn: Number(settings["SplitMic LinkedIn Target"] ?? defaultTargets.splitmicLinkedIn),
          splitmicEmail: Number(settings["SplitMic Email Target"] ?? defaultTargets.splitmicEmail),
          bookwormTikTok: Number(settings["Bookworm TikTok Target"] ?? defaultTargets.bookwormTikTok),
          bookwormEmail: Number(settings["Bookworm Email Target"] ?? defaultTargets.bookwormEmail),
          splitmicCalls: Number(settings["SplitMic Calls Target"] ?? defaultTargets.splitmicCalls),
          bookwormCalls: Number(settings["Bookworm Calls Target"] ?? defaultTargets.bookwormCalls),
        });
      } catch {
        // The boards below already surface provider errors. Keep this summary quiet.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return <DailyOutreachProgress business={business} counts={counts} targets={targets} />;
}
