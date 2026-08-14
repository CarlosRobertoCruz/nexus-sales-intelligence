import { formatIsoDate, parseIsoDateAtLocalMidnight } from "./isoDate";

export function parseCalendarIsoDate(isoDate: string): Date | null {
  if (!isoDate) return null;
  const parsed = parseIsoDateAtLocalMidnight(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toCalendarIsoDate(date: Date): string {
  return formatIsoDate({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function startOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function buildCalendarMonthGrid(monthCursor: Date): Date[] {
  const firstDay = startOfCalendarMonth(monthCursor);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
}
