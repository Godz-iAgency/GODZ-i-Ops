import { NextRequest, NextResponse } from "next/server";
import {
  getExecutionSettings,
  saveExecutionSettings,
  type ExecutionSettings,
} from "@/lib/airtable";

export async function GET() {
  const { settings } = await getExecutionSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<ExecutionSettings>;
  const keys: Array<keyof ExecutionSettings> = [
    "SplitMic LinkedIn Target",
    "SplitMic Email Target",
    "Bookworm TikTok Target",
    "Bookworm Email Target",
  ];
  const settings = {} as ExecutionSettings;
  for (const key of keys) {
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return NextResponse.json({ error: `${key} must be a whole number from 0 to 100` }, { status: 400 });
    }
    settings[key] = value;
  }
  return NextResponse.json({ settings: await saveExecutionSettings(settings) });
}

