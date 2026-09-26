import { NextResponse } from "next/server";
import { getAllReplies } from "@/lib/database";

export async function GET() {
  const replies = await getAllReplies();
  return NextResponse.json({ replies });
}
