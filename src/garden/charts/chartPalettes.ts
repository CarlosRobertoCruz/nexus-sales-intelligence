import { TOKENS } from "@/garden/tokens";

export type ChartPalette = "default" | "pastel";
export type ChartTone = "primary" | "positive" | "warning" | "negative" | "neutral" | "info";

export function resolveChartToneColor(tone: ChartTone, palette: ChartPalette = "default"): string {
  if (palette === "pastel") {
    return TOKENS.color.chart.pastel[tone];
  }

  if (tone === "primary") return TOKENS.color.chart.seriesPrimary;
  if (tone === "positive") return TOKENS.color.chart.positive;
  if (tone === "warning") return TOKENS.color.chart.warning;
  if (tone === "negative") return TOKENS.color.chart.negative;
  if (tone === "neutral") return TOKENS.color.chart.neutral;
  return TOKENS.color.chart.info;
}
