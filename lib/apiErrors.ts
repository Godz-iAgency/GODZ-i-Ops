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
  const billingLimit = /PUBLIC_API_BILLING_LIMIT_EXCEEDED|billing plan limit|maximum number of requests allowed for this month/i.test(details);
  const rateLimit = /429|RATE_LIMIT|too many requests/i.test(details);

  if (billingLimit) {
    return NextResponse.json(
      {
        error: "Airtable's monthly API allowance has been reached. Live records are temporarily unavailable until the allowance resets or the data source is changed.",
        code: "AIRTABLE_MONTHLY_LIMIT",
        retryable: false,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (rateLimit) {
    return NextResponse.json(
      {
        error: "Airtable is refusing API requests. This workspace has reached its monthly allowance; after the allowance resets, a short rate limit can take up to 30 seconds to clear.",
        code: "AIRTABLE_LIMIT",
        retryable: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } }
    );
  }

  return NextResponse.json(
    { error: fallback, code: "DATA_PROVIDER_ERROR", retryable: true },
    { status: 502, headers: { "Cache-Control": "no-store" } }
  );
}
