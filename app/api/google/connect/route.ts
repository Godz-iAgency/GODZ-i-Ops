import { NextRequest, NextResponse } from "next/server";

// One-time setup helper for granting Gmail send/modify access. Visiting this
// route with no code redirects to Google's consent screen; Google sends the
// user back here with a code, which is exchanged for a refresh token.
//
// This is safe to expose: a stranger who opens it just gets Google's own login,
// and any token minted would belong to whichever account THEY signed in with --
// never this account's. Only someone who can log in as the owner sees the
// owner's token.

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify", // read, label, archive
  "https://www.googleapis.com/auth/gmail.send", // send outreach + replies
  "https://www.googleapis.com/auth/calendar.events", // read/write events on the primary calendar
].join(" ");

function page(title: string, inner: string): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#0a0705;color:#f5f3f1;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
 .card{max-width:620px;width:100%;background:#141010;border:1px solid #2a2422;border-radius:16px;padding:32px}
 h1{margin:0 0 16px;font-size:20px}
 code{display:block;word-break:break-all;background:#0a0705;border:1px solid #2a2422;
      border-radius:10px;padding:14px;margin:14px 0;font:13px/1.5 ui-monospace,monospace;color:#e8430a}
 p{color:#a09a96;margin:8px 0}
 a{color:#e8430a}
</style></head><body><div class="card"><h1>${title}</h1>${inner}</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");

  if (!clientId || !clientSecret || !appUrl) {
    return page("Not configured", "<p>GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL must all be set.</p>");
  }

  const redirectUri = `${appUrl}/api/google/connect`;
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return page("Google returned an error", `<p>${error}</p><p>Nothing was changed.</p>`);
  }

  if (!code) {
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", SCOPES);
    // Forcing consent is what makes Google mint a NEW refresh token; without
    // it an already-approved account silently returns none.
    auth.searchParams.set("access_type", "offline");
    auth.searchParams.set("prompt", "consent");
    return NextResponse.redirect(auth.toString());
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    return page(
      "Could not get a refresh token",
      `<p>${JSON.stringify(data).slice(0, 400)}</p>
       <p>If it says a token was already granted, revoke this app at
       <a href="https://myaccount.google.com/permissions" target="_blank">Google account permissions</a> and try again.</p>`
    );
  }

  return page(
    "Connected",
    `<p>Copy this into <b>GOOGLE_REFRESH_TOKEN</b> in <code style="display:inline;padding:2px 6px">.env.local</code>
      and in Vercel, then redeploy. Then close this tab.</p>
     <code>${data.refresh_token}</code>
     <p>Scopes granted: ${data.scope || SCOPES}</p>`
  );
}
