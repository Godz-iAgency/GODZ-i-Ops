"use client";

import { Calendar, Linkedin, Instagram, Mail, Sparkles, Share2, Send, Link2 } from "lucide-react";

const LINKS = [
  { label: "Booking Calendar", url: "https://app.cal.com/bookings/upcoming", icon: Calendar, color: "#F2C94C" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/christopher-downer/", icon: Linkedin, color: "#56CCF2" },
  { label: "Instagram", url: "https://www.instagram.com/drum.adik/", icon: Instagram, color: "#EF6C9E" },
  { label: "Email", url: "https://mail.google.com/mail/u/0/#inbox", icon: Mail, color: "#71717a", sub: "christopher@godz-iagency.com" },
  { label: "Telegram", url: "https://web.telegram.org/a/#8256107242", icon: Send, color: "#29A9EA" },
  { label: "GODZ-i", url: "https://www.godz-iagency.com/", icon: Sparkles, color: "#e8430a" },
  { label: "SplitMic", url: "https://www.splitmic.com/", icon: Share2, color: "#5FBF7A" },
];

export default function LinksTab() {
  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-3">
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
