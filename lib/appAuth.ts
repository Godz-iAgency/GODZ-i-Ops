import { NextRequest } from "next/server";

// The deployed app is on a public URL, so anything that spends money or
// touches real leads (sending outreach, posting to social) sits behind a
// password the user enters once on their device. Cron endpoints use
// CRON_SECRET instead -- machines, not humans.
export function isAuthorized(req: NextRequest): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  return req.headers.get("x-app-password") === password;
}
