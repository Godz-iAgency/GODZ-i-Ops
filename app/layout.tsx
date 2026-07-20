import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GODZ-i / Command Center",
  description: "Outreach and sprint command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-glow" />
        <div className="grain-overlay" />
        {children}
      </body>
    </html>
  );
}
