import { NextRequest, NextResponse } from "next/server";
import { getContactsNeedingEmail } from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 50);
    const contacts = await getContactsNeedingEmail(limit);
    return NextResponse.json({ contacts });
  } catch (error) {
    return providerErrorResponse(error, "Could not load contacts that need email research.");
  }
}
