import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/appAuth";
import { addContentToQueue, deleteQueuedContent } from "@/lib/airtable";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const created = await addContentToQueue(content.trim());
  return NextResponse.json(created);
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteQueuedContent(id);
  return NextResponse.json({ deleted: true });
}
