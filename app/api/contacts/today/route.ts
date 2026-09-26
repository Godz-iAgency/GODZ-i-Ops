import { NextRequest, NextResponse } from "next/server";
import { getTodaysContacts, getEmailPipelineCounts } from "@/lib/airtable";
import { providerErrorResponse } from "@/lib/apiErrors";

// TODAY'S 10. Surfaces who is up next -- it never sends anything. Emails stay
// personal and hand-written; the app just removes the "who do I email today?"
// decision and tracks the answer. Only records with a real email address
// qualify, so research targets never leak into the send list.
export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 50);
    const [contacts, counts] = await Promise.all([getTodaysContacts(limit), getEmailPipelineCounts()]);
    return NextResponse.json({ contacts, ...counts });
  } catch (error) {
    return providerErrorResponse(error, "Could not load today's SplitMic email queue.");
  }
}
