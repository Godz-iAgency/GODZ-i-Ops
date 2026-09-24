// Verified against the configured Gemini API key on 2026-09-24. Keep the
// default stable, but allow deployment configuration to change it without a
// code release when Google introduces a better Flash-Lite model.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

