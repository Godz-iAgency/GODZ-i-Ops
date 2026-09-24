import {
  getAllBookwormContacts,
  getAllBookwormTikTokCreators,
  getAllContacts,
  getAllLinkedInProspects,
  getAllProgress,
  getExecutionSettings,
  getProgressForDate,
  type ExecutionSettings,
  type ProgressFields,
  type Contact,
  type LinkedInProspect,
  type BookwormContact,
  type BookwormTikTokCreator,
} from "./airtable";

export type OutreachChannel = "LinkedIn" | "TikTok" | "Email" | "Other";
export type Project = "Splitmic" | "Bookworm";

export type FollowUp = {
  id: string;
  source: "splitmic-email" | "splitmic-linkedin" | "bookworm-email" | "bookworm-tiktok";
  project: Project;
  channel: OutreachChannel;
  name: string;
  company?: string;
  dueDate: string;
  action?: string;
  profileUrl?: string;
  status?: string;
};

export type DailyCounts = {
  splitmicLinkedIn: number;
  splitmicEmail: number;
  bookwormTikTok: number;
  bookwormEmail: number;
};

function dateOnly(value?: string): string {
  return value ? value.slice(0, 10) : "";
}

function countContactedOn(
  date: string,
  values: Array<string | undefined>
): number {
  return values.filter((value) => dateOnly(value) === date).length;
}

function progressCounts(progress: ProgressFields | null): DailyCounts {
  return {
    splitmicLinkedIn: Number(progress?.["LinkedIn Sent"] || 0),
    splitmicEmail: Number(progress?.["Emails Sent"] || 0),
    bookwormTikTok: Number(progress?.["Bookworm TikTok Sent"] || 0),
    bookwormEmail: Number(progress?.["Bookworm Emails Sent"] || 0),
  };
}

export function marketingTotal(counts: DailyCounts): number {
  return counts.splitmicLinkedIn + counts.splitmicEmail + counts.bookwormTikTok + counts.bookwormEmail;
}

export function marketingTarget(settings: ExecutionSettings): number {
  return (
    settings["SplitMic LinkedIn Target"] +
    settings["SplitMic Email Target"] +
    settings["Bookworm TikTok Target"] +
    settings["Bookworm Email Target"]
  );
}

function followUpsFromRecords(
  date: string,
  contacts: Contact[],
  linkedin: LinkedInProspect[],
  bookworm: BookwormContact[],
  tiktok: BookwormTikTokCreator[]
): FollowUp[] {
  return [
    ...contacts
      .filter((c) => dateOnly(c.fields["Next Action Date"] || c.fields["Email Follow-up Date"]) === date)
      .map((c) => ({
        id: c.id,
        source: "splitmic-email" as const,
        project: "Splitmic" as const,
        channel: "Email" as const,
        name: c.fields["Name / Target"] || "Unnamed contact",
        company: c.fields.Organization,
        dueDate: date,
        action: c.fields["Next Action"],
        profileUrl: c.fields["LinkedIn URL"] || c.fields.Website,
        status: c.fields["Relationship Status"],
      })),
    ...linkedin
      .filter((p) => dateOnly(p.fields["Next Action Date"]) === date)
      .map((p) => ({
        id: p.id,
        source: "splitmic-linkedin" as const,
        project: "Splitmic" as const,
        channel: "LinkedIn" as const,
        name: p.fields.Name || "Unnamed contact",
        company: p.fields.Organization,
        dueDate: date,
        action: p.fields["Next Action"],
        profileUrl: p.fields["LinkedIn URL"],
        status: p.fields.Status,
      })),
    ...bookworm
      .filter((c) => dateOnly(c.fields["Next Action Date"]) === date)
      .map((c) => ({
        id: c.id,
        source: "bookworm-email" as const,
        project: "Bookworm" as const,
        channel: "Email" as const,
        name: c.fields.Name || "Unnamed contact",
        dueDate: date,
        action: c.fields["Next Action"],
        profileUrl: c.fields["Profile URL"],
        status: c.fields["Relationship Status"],
      })),
    ...tiktok
      .filter((c) => dateOnly(c.fields["Next Action Date"]) === date && !c.fields.Excluded)
      .map((c) => ({
        id: c.id,
        source: "bookworm-tiktok" as const,
        project: "Bookworm" as const,
        channel: "TikTok" as const,
        name: c.fields["Display Name"] || c.fields.Name || c.fields["TikTok Handle"] || "Unnamed creator",
        dueDate: date,
        action: c.fields["Next Action"],
        profileUrl: c.fields["TikTok URL"],
        status: c.fields.Status,
      })),
  ].sort((a, b) => a.channel.localeCompare(b.channel) || a.name.localeCompare(b.name));
}

export async function getFollowUps(date: string): Promise<FollowUp[]> {
  const [contacts, linkedin, bookworm, tiktok] = await Promise.all([
    getAllContacts(),
    getAllLinkedInProspects(),
    getAllBookwormContacts(),
    getAllBookwormTikTokCreators(),
  ]);
  return followUpsFromRecords(date, contacts, linkedin, bookworm, tiktok);
}

export async function getDailyExecution(date: string) {
  const [progress, settingsResult, contacts, linkedin, bookworm, tiktok] = await Promise.all([
    getProgressForDate(date),
    getExecutionSettings(),
    getAllContacts(),
    getAllLinkedInProspects(),
    getAllBookwormContacts(),
    getAllBookwormTikTokCreators(),
  ]);

  const saved = progressCounts(progress);
  const actual: DailyCounts = {
    splitmicLinkedIn: countContactedOn(date, linkedin.map((p) => p.fields["Date Contacted"])),
    splitmicEmail: countContactedOn(date, contacts.map((c) => c.fields["Email Last Contacted"])),
    bookwormTikTok: countContactedOn(date, tiktok.map((c) => c.fields["Date Contacted"])),
    bookwormEmail: countContactedOn(date, bookworm.map((c) => c.fields["Last Contact"])),
  };
  const counts: DailyCounts = {
    splitmicLinkedIn: Math.max(saved.splitmicLinkedIn, actual.splitmicLinkedIn),
    splitmicEmail: Math.max(saved.splitmicEmail, actual.splitmicEmail),
    bookwormTikTok: Math.max(saved.bookwormTikTok, actual.bookwormTikTok),
    bookwormEmail: Math.max(saved.bookwormEmail, actual.bookwormEmail),
  };
  const settings = settingsResult.settings;
  const followUps = followUpsFromRecords(date, contacts, linkedin, bookworm, tiktok);
  const marketingComplete = marketingTotal(counts) >= marketingTarget(settings);
  const buildComplete = progress?.["Build Status"] === "Complete" || !!progress?.["Build Completed"];
  const deliveryComplete = progress?.["Delivery Status"] === "Complete" || !!progress?.["Deliver Completed"];

  return {
    date,
    progress,
    settings,
    counts,
    total: marketingTotal(counts),
    target: marketingTarget(settings),
    blocksComplete: [marketingComplete, buildComplete, deliveryComplete].filter(Boolean).length,
    blockStatus: { marketingComplete, buildComplete, deliveryComplete },
    followUps,
    followUpCounts: followUps.reduce<Record<string, number>>((acc, item) => {
      acc[item.channel] = (acc[item.channel] || 0) + 1;
      return acc;
    }, {}),
  };
}

function mondayFor(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

export async function getWeeklyExecution(date: string) {
  const [allProgress, settingsResult] = await Promise.all([getAllProgress(), getExecutionSettings()]);
  const start = mondayFor(date);
  const days = [...Array(5)].map((_, index) => {
    const value = new Date(`${start}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
  const rows = days.map((day) => {
    const progress = allProgress.find((item) => item.Date === day) || null;
    const counts = progressCounts(progress);
    return {
      date: day,
      counts,
      marketingComplete: marketingTotal(counts) >= marketingTarget(settingsResult.settings),
      buildComplete: progress?.["Build Status"] === "Complete" || !!progress?.["Build Completed"],
      deliveryComplete: progress?.["Delivery Status"] === "Complete" || !!progress?.["Deliver Completed"],
    };
  });
  const totals = rows.reduce<DailyCounts>(
    (acc, row) => ({
      splitmicLinkedIn: acc.splitmicLinkedIn + row.counts.splitmicLinkedIn,
      splitmicEmail: acc.splitmicEmail + row.counts.splitmicEmail,
      bookwormTikTok: acc.bookwormTikTok + row.counts.bookwormTikTok,
      bookwormEmail: acc.bookwormEmail + row.counts.bookwormEmail,
    }),
    { splitmicLinkedIn: 0, splitmicEmail: 0, bookwormTikTok: 0, bookwormEmail: 0 }
  );
  return { start, rows, totals, settings: settingsResult.settings };
}
