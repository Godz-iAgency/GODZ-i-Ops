"use client";

import { Calendar, Linkedin, Instagram, Mail, Sparkles, Share2, Link2 } from "lucide-react";

const LINKS = [
  { label: "Booking Calendar", url: "https://app.cal.com/bookings/upcoming", icon: Calendar, color: "#F2C94C" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/christopher-downer/", icon: Linkedin, color: "#56CCF2" },
  { label: "Instagram", url: "https://www.instagram.com/drum.adik/", icon: Instagram, color: "#EF6C9E" },
  { label: "Email", url: "https://mail.google.com/mail/u/0/#inbox", icon: Mail, color: "#999", sub: "christopher@godz-iagency.com" },
  { label: "GODZ-i", url: "https://www.godz-iagency.com/", icon: Sparkles, color: "#F0451F" },
  { label: "SplitMic", url: "https://www.splitmic.com/", icon: Share2, color: "#5FBF7A" },
];

export default function LinksTab() {
  return (
    <div className="max-w-xl mx-auto flex flex-col gap-2">
      {LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-[#141414] border border-[#2C2C2C]"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#1F1F1F]">
              <Icon size={17} color={link.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{link.label}</p>
              {link.sub && <p className="text-xs truncate text-[#999]">{link.sub}</p>}
            </div>
            <Link2 size={14} color="#999" />
          </a>
        );
      })}
    </div>
  );
}
