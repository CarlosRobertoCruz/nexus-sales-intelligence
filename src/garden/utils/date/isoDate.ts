const MS_PER_DAY = 86_400_000;

export interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

export function parseIsoDateParts(isoDate: string): IsoDateParts {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
  };
}

export function formatIsoDate(parts: IsoDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function parseIsoDateAtLocalMidnight(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

export function getTodayIsoDate(referenceDate: Date = new Date()): string {
  return formatIsoDate({
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth() + 1,
    day: referenceDate.getDate(),
  });
}

export function isoDateToUtcDayIndex(isoDate: string): number {
  const { year, month, day } = parseIsoDateParts(isoDate);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function utcDayIndexToIsoDate(dayIndex: number): string {
  const date = new Date(dayIndex * MS_PER_DAY);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  return utcDayIndexToIsoDate(isoDateToUtcDayIndex(isoDate) + deltaDays);
}

/** Normaliza DATE/ISO do Postgres para `YYYY-MM-DD` (evita `String(Date).slice(0,10)` inválido). */
export function normalizeIsoDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatIsoDate({
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    });
  }
  const text = String(value).trim();
  if (!text) return null;
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatIsoDate({
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  });
}

export function formatShortPtBrDayMonthFromIso(iso: string | null | undefined): string {
  const normalized = normalizeIsoDateOnly(iso);
  const fallback = () =>
    parseIsoDateAtLocalMidnight(getTodayIsoDate()).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  if (!normalized) return fallback();
  const d = parseIsoDateAtLocalMidnight(normalized);
  if (Number.isNaN(d.getTime())) return fallback();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Valor para `<input type="datetime-local" />` no fuso local. */
export function getNowDatetimeLocalValue(referenceDate: Date = new Date()): string {
  return `${getTodayIsoDate(referenceDate)}T${pad2(referenceDate.getHours())}:${pad2(referenceDate.getMinutes())}`;
}

export function parseReceivedAtToDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const text = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseIsoDateAtLocalMidnight(text);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return new Date(`${text}:00`);
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPtBrDateTimeFromIso(iso: string | null | undefined): string {
  const d = parseReceivedAtToDate(iso) ?? new Date();
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}
