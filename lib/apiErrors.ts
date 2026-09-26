import { NextResponse } from "next/server";

type ProviderErrorShape = {
  error?: unknown;
  message?: unknown;
  statusCode?: unknown;
  status?: unknown;
  errors?: unknown;
};

function describe(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as ProviderErrorShape;
    try {
      return [error instanceof Error ? error.message : null, value.error, value.message, value.statusCode, value.status, value.errors]
        .filter((item) => item != null)
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(" ");
    } catch {
      return "";
    }
  }
  return "";
}

export function providerErrorResponse(error: unknown, fallback: string) {
  const details = describe(error);
  const permission = /403|PERMISSION_DENIED|permission/i.test(details);

  return NextResponse.json(
    {
      error: permission
        ? "Google Sheets access was denied. Confirm the spreadsheet is shared with the GODZ-i service account as an Editor."
        : fallback,
      code: permission ? "GOOGLE_SHEETS_PERMISSION" : "GOOGLE_SHEETS_ERROR",
      retryable: true,
    },
    { status: permission ? 503 : 502, headers: { "Cache-Control": "no-store" } }
  );
}
