import { NextRequest, NextResponse } from "next/server";
import { getProgressForDate, getAllProgress, saveProgress, ProgressFields } from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

// ?date=YYYY-MM-DD for one day, ?all=1 for the whole 100-day grid.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    if (params.get("all")) {
      const days = await getAllProgress();
      return NextResponse.json({ days });
    }

    const date = params.get("date");
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    const progress = await getProgressForDate(date);
    return NextResponse.json({ progress });
  } catch (error) {
    return providerErrorResponse(error, "Could not load daily progress.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProgressFields & { Date?: string };
    const date = body.Date;
    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    const saved = await saveProgress(date, body);
    return NextResponse.json({ progress: saved });
  } catch (error) {
    return providerErrorResponse(error, "Could not save daily progress.");
  }
}
