import { shiftIsoDate } from "./isoDate";
import type {
  RelativePeriodMatchResult,
  RelativePeriodPresetKey,
} from "@/garden/types/datePeriod";

// Re-export dos tipos canônicos (fonte: garden/types/datePeriod)
export type { RelativePeriodMatchResult, RelativePeriodPresetKey };

export const RELATIVE_PERIOD_PRESET_ORDER: readonly RelativePeriodPresetKey[] = [
  "today",
  "yesterday",
  "last7",
  "last15",
  "last30",
  "last60",
  "last90",
  "last180",
  "last365",
];

export function getIsoDateRangeForRelativePeriodPreset(
  key: RelativePeriodPresetKey,
  todayIso: string,
): { dateStart: string; dateEnd: string } {
  switch (key) {
    case "today":
      return { dateStart: todayIso, dateEnd: todayIso };
    case "yesterday": {
      const yesterday = shiftIsoDate(todayIso, -1);
      return { dateStart: yesterday, dateEnd: yesterday };
    }
    case "last7":
    case "last15":
    case "last30":
    case "last60":
    case "last90":
    case "last180":
    case "last365": {
      const inclusiveDays =
        key === "last7"
          ? 7
          : key === "last15"
            ? 15
            : key === "last30"
              ? 30
              : key === "last60"
                ? 60
                : key === "last90"
                  ? 90
                  : key === "last180"
                    ? 180
                    : 365;
      return {
        dateStart: shiftIsoDate(todayIso, -(inclusiveDays - 1)),
        dateEnd: todayIso,
      };
    }
  }
}

export function matchRelativePeriodPreset(
  filters: { dateStart: string; dateEnd: string },
  todayIso: string,
): RelativePeriodMatchResult {
  const { dateStart, dateEnd } = filters;
  if (!dateStart && !dateEnd) return "custom";

  for (const key of RELATIVE_PERIOD_PRESET_ORDER) {
    const range = getIsoDateRangeForRelativePeriodPreset(key, todayIso);
    if (dateStart === range.dateStart && dateEnd === range.dateEnd) return key;
  }
  return "custom";
}
