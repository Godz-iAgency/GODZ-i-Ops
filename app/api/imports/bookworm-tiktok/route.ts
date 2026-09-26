import { NextRequest, NextResponse } from "next/server";
import {
  BookwormTikTokFields,
  getAllBookwormTikTokCreators,
  getBookwormTikTokTable,
} from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

type ImportBody = { creators?: BookwormTikTokFields[] };

const keyFor = (fields: BookwormTikTokFields) =>
  String(fields["TikTok User ID"] || fields["TikTok Handle"] || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as ImportBody;
    if (!Array.isArray(body.creators) || body.creators.length > 500) {
      return NextResponse.json({ error: "creators must be an array of at most 500 records" }, { status: 400 });
    }

    const incoming = new Map<string, BookwormTikTokFields>();
    let skipped = 0;
    for (const creator of body.creators) {
      const key = keyFor(creator);
      if (!key) {
        skipped++;
        continue;
      }
      incoming.set(key, creator);
    }

    const existing = await getAllBookwormTikTokCreators();
    const existingByKey = new Map<string, string>();
    for (const creator of existing) {
      const key = keyFor(creator.fields);
      if (key) existingByKey.set(key, creator.id);
    }

    const creates: Array<{ fields: BookwormTikTokFields }> = [];
    const updates: Array<{ id: string; fields: BookwormTikTokFields }> = [];
    for (const [key, fields] of incoming) {
      const id = existingByKey.get(key);
      if (id) updates.push({ id, fields });
      else creates.push({ fields: { ...fields, Status: fields.Status || "New" } });
    }

    const table = getBookwormTikTokTable();
    if (creates.length) await table.create(creates, { typecast: true });
    if (updates.length) await table.update(updates, { typecast: true });

    return NextResponse.json({ created: creates.length, updated: updates.length, skipped });
  } catch (error) {
    return providerErrorResponse(error, "Could not import Bookworm TikTok creators into Google Sheets.");
  }
}
