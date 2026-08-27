import { NextRequest, NextResponse } from "next/server";
import { verifyContactToken } from "@/lib/unsubscribeToken";
import { getContactById, suppressContact } from "@/lib/airtable";

// Public by necessity -- recipients are strangers with no login. The HMAC in
// the link is what stands in for authentication, so a valid token is the only
// thing that can suppress a row.

function page(title: string, message: string, ok: boolean): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0a0705; color:#f5f3f1; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:24px; }
  .card { max-width:460px; text-align:center; background:#141010; border:1px solid #2a2422;
          border-radius:16px; padding:40px 32px; }
  h1 { margin:0 0 12px; font-size:20px; color:${ok ? "#f5f3f1" : "#e8430a"}; }
  p { margin:0; color:#a09a96; }
</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function unsubscribe(id: string | null, token: string | null): Promise<boolean> {
  if (!id || !token || !verifyContactToken(id, token)) return false;
  const contact = await getContactById(id);
  if (!contact) return false;
  if (!contact.fields["Do Not Contact"]) {
    await suppressContact(id, "Unsubscribed");
  }
  return true;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ok = await unsubscribe(params.get("c"), params.get("t"));
  return ok
    ? page("You're unsubscribed", "You won't receive any more emails from us. Sorry for the interruption.", true)
    : page("Link not valid", "This unsubscribe link is invalid or has expired. Reply to the email and we'll remove you by hand.", false);
}

// RFC 8058 one-click: Gmail and Outlook POST here themselves when someone uses
// the unsubscribe button in the mail client, with no human ever seeing a page.
export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ok = await unsubscribe(params.get("c"), params.get("t"));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
