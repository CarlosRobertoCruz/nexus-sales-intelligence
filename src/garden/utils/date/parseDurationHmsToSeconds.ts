const HMS_RE = /^(\d+):(\d{2}):(\d{2})$/;

export function parseDurationHmsToSeconds(hms: string): number | null {
  const t = hms.trim();
  const m = t.match(HMS_RE);
  if (!m) return null;

  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  const s = parseInt(m[3]!, 10);
  if (min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}
