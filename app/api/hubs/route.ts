import { NextResponse } from "next/server";
import { getAllHubs } from "@/lib/database";

export async function GET() {
  const hubs = await getAllHubs();
  return NextResponse.json({ hubs });
}
