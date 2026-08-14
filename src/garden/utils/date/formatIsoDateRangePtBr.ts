function isoToPtBr(iso: string): string {
  const parts = iso.trim().split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Ex.: `2026-02-28` → `28/02/2026`; intervalo com "até" quando fim ≠ início. */
export function formatIsoDateRangePtBr(dateStartIso: string, dateEndIso: string): string {
  const start = dateStartIso.trim();
  const end = (dateEndIso.trim() || start).trim();
  if (!start) return "";
  if (end === start) return isoToPtBr(start);
  return `${isoToPtBr(start)} até ${isoToPtBr(end)}`;
}
