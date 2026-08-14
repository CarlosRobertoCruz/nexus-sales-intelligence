import { useCallback, useState, type MouseEvent } from "react";
import {
  DataTooltipHeading,
  DataTooltipMetaSuffix,
  DataTooltipMetricLine,
  FloatingTooltip,
  Stack,
} from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";
import { resolveChartToneColor, type ChartPalette, type ChartTone } from "./chartPalettes";

export type StackedBarSegment = {
  value: number;
  tone?: ChartTone;
  color?: string;
};

export type StackedBarChartTooltipProps = {
  heading: string;
  /** Uma legenda por segmento, na mesma ordem de `segments`. */
  valueLabels: readonly string[];
};

type StackedBarChartProps = {
  segments: StackedBarSegment[];
  palette?: ChartPalette;
  height?: number;
  radius?: number;
  gap?: number;
  tooltip?: StackedBarChartTooltipProps;
};

export function StackedBarChart({
  segments,
  palette = "default",
  height = 14,
  radius = 4,
  gap = 1,
  tooltip,
}: StackedBarChartProps) {
  const rawTotal = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const total = rawTotal > 0 ? rawTotal : 1;
  const [hover, setHover] = useState<{ clientX: number; clientY: number } | null>(null);

  const clearHover = useCallback(() => {
    setHover(null);
  }, []);

  const handlePointer = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!tooltip) return;
    setHover({ clientX: event.clientX, clientY: event.clientY });
  }, [tooltip]);

  const showTip = tooltip != null && hover != null;

  return (
    <>
      <div
        role={tooltip ? "img" : undefined}
        aria-label={tooltip?.heading}
        onMouseEnter={handlePointer}
        onMouseMove={handlePointer}
        onMouseLeave={clearHover}
        style={{
          display: "flex",
          width: "100%",
          height,
          gap,
          overflow: "hidden",
          borderRadius: radius,
          background: TOKENS.color.surface.subtle,
          ...(tooltip ? { cursor: "default" as const } : {}),
        }}
      >
        {segments.map((segment, index) => {
          const value = Math.max(0, segment.value);
          const fillColor =
            segment.color ?? (segment.tone ? resolveChartToneColor(segment.tone, palette) : TOKENS.color.transparent);

          return (
            <div
              key={index}
              style={{
                width: `${(value / total) * 100}%`,
                minWidth: value > 0 ? 1 : 0,
                background: fillColor,
              }}
            />
          );
        })}
      </div>
      {tooltip && (
        <FloatingTooltip open={showTip} anchorX={hover?.clientX ?? 0} anchorY={hover?.clientY ?? 0}>
          <Stack gap={TOKENS.spacing[4]}>
            <DataTooltipHeading>{tooltip.heading}</DataTooltipHeading>
            {segments.map((segment, index) => {
              const value = Math.max(0, segment.value);
              const label = tooltip.valueLabels[index] ?? `—`;
              const rowInk =
                segment.tone != null
                  ? resolveChartToneColor(segment.tone, "default")
                  : segment.color ?? TOKENS.color.content.muted;
              const pct = rawTotal > 0 ? (value / rawTotal) * 100 : 0;
              const pctFormatted = pct.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
              });
              return (
                <DataTooltipMetricLine
                  key={index}
                  label={label}
                  value={value.toLocaleString("pt-BR")}
                  ink={rowInk}
                  meta={
                    rawTotal > 0 ? (
                      <DataTooltipMetaSuffix>
                        {" "}
                        ({pctFormatted}%)
                      </DataTooltipMetaSuffix>
                    ) : undefined
                  }
                />
              );
            })}
          </Stack>
        </FloatingTooltip>
      )}
    </>
  );
}
