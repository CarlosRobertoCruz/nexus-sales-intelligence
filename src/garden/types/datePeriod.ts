// Tipos de período relativo ISO — domain-blind; usados por utils/date e features.

export type RelativePeriodPresetKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last15"
  | "last30"
  | "last60"
  | "last90"
  | "last180"
  | "last365";

/** Preset relativo ou range manual (`custom`). */
export type RelativePeriodMatchResult = RelativePeriodPresetKey | "custom";
