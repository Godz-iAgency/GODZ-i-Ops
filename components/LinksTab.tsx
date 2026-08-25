"use client";

import { Calendar, Linkedin, Mail, Share2, Table2, Link2 } from "lucide-react";

const AIRTABLE_BASE = "https://airtable.com/appVoya6LLvnSjCbQ";

const LINKS = [
  { label: "Booking Calendar", url: "https://app.cal.com/bookings/upcoming", icon: Calendar, color: "#F2C94C" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/christopher-downer/", icon: Linkedin, color: "#56CCF2" },
  { label: "Email", url: "https://mail.google.com/mail/u/0/#inbox", icon: Mail, color: "#71717a", sub: "christopher@godz-iagency.com" },
  { label: "SplitMic", url: "https://www.splitmic.com/", icon: Share2, color: "#5FBF7A" },
  { label: "Airtable", url: AIRTABLE_BASE, icon: Table2, color: "#e8430a", sub: "SplitMic Outreach, LinkedIn, Daily Progress" },
];

export default function LinksTab() {
  return (
    <div className="flex flex-col gap-3">
      {LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-5 py-5 rounded-xl bg-surface2 border border-border transition-all hover:border-accent hover:-translate-y-0.5"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface3">
              <Icon size={20} color={link.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground">{link.label}</p>
              {link.sub && <p className="text-sm truncate text-muted">{link.sub}</p>}
            </div>
            <Link2 size={17} color="var(--color-muted)" />
          </a>
        );
      })}
    </div>
  );
}
