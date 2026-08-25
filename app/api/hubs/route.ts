import { NextResponse } from "next/server";
import { getAllHubs } from "@/lib/airtable";

export async function GET() {
  const hubs = await getAllHubs();
  return NextResponse.json({ hubs });
}
