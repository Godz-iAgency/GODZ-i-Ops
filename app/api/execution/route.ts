import { NextRequest, NextResponse } from "next/server";
import { getDailyExecution, getWeeklyExecution } from "@/lib/execution";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const [daily, weekly] = await Promise.all([getDailyExecution(date), getWeeklyExecution(date)]);
  return NextResponse.json({ daily, weekly });
}

