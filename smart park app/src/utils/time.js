export function normalizeDbTimestampToIsoUtc(value) {
  if (!value) return null;
  const s = String(value);
  // If it already includes timezone info, keep it.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return s;
  // Supabase can return "timestamp without time zone" strings like "2026-04-10T15:11:37.729"
  // Treat them as UTC to avoid local-time parsing issues.
  return `${s}Z`;
}

