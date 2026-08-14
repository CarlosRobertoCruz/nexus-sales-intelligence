import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  DataTooltipHeading,
  DataTooltipMetaSuffix,
  DataTooltipMetricLine,
  FloatingTooltip,
  Stack,
} from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";
import { resolveChartToneColor, type ChartPalette, type ChartTone } from "./chartPalettes";

type DonutSegment = { percentage: number; color?: string; tone?: ChartTone };

export type MultiDonutChartTooltipProps = {
  /** Título fixo da dica (ex.: título do cartão). */
  heading: string;
  /** Uma legenda por segmento, na mesma ordem de `segments`. */
  valueLabels: readonly string[];
  /** Contagem por segmento (mesma ordem); o % é derivado da soma. */
  counts: readonly number[];
};

type MultiDonutChartProps = {
  segments: DonutSegment[];
  trackColor?: string;
  palette?: ChartPalette;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  tooltip?: MultiDonutChartTooltipProps;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toPct = (n: number) => clamp(n, 0, 100);

const DEFAULT_SEGMENTS: DonutSegment[] = [{ percentage: 0, color: "transparent" }];

const ringStyle: CSSProperties = { display: "block" };

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/**
 * Anel de progresso com múltiplos segmentos (cada % e cor).
 */
export function MultiDonutChart({
  segments,
  trackColor = TOKENS.color.surface.subtle,
  palette = "default",
  size = 84,
  strokeWidth = 8,
  children,
  tooltip,
}: MultiDonutChartProps) {
  const [pointer, setPointer] = useState<{ clientX: number; clientY: number; origIdx: number } | null>(
    null,
  );

  const clearHover = useCallback(() => {
    setPointer(null);
  }, []);

  const normalized = useMemo(
    () => (segments.length ? segments : DEFAULT_SEGMENTS).map((seg) => ({
      ...seg,
      color: seg.color ?? (seg.tone ? resolveChartToneColor(seg.tone, palette) : TOKENS.color.transparent),
    })),
    [palette, segments],
  );
  const total = useMemo(
    () => Math.max(0, normalized.reduce((sum, s) => sum + s.percentage, 0)),
    [normalized],
  );

  const ringPaths = useMemo(() => {
    if (total <= 0) {
      return [] as {
        key: string;
        d: string;
        origIdx: number;
        color: string;
      }[];
    }
    const gapDeg = 1.0;
    const usedSegments = normalized
      .map((seg, origIdx) => ({
        ...seg,
        origIdx,
        percentage: toPct((seg.percentage / total) * 100),
      }))
      .filter((s) => s.percentage > 0.05);
    const perGap = usedSegments.length > 1 ? gapDeg : 0;
    const totalGap = perGap * usedSegments.length;
    const sweepAvailable = 360 - totalGap;
    let acc = 0;
    return usedSegments.map((seg, i) => {
      const start = -90 + acc;
      const rawSweep = (seg.percentage / 100) * sweepAvailable;
      const sweep = rawSweep >= 360 ? 359.99 : rawSweep;
      const d = describeArc(50, 50, 40, start, start + sweep);
      acc += sweep + (i < usedSegments.length - 1 ? perGap : 0);
      return { key: `seg-${seg.origIdx}`, d, origIdx: seg.origIdx, color: seg.color };
    });
  }, [normalized, total]);

  const countSum = tooltip != null ? Math.max(0, tooltip.counts.reduce((s, n) => s + n, 0)) : 0;
  const showTip = tooltip != null && pointer != null;
  const tipIdx = pointer?.origIdx ?? 0;
  const tipCount = tooltip?.counts[tipIdx] ?? 0;
  const tipLabel = tooltip?.valueLabels[tipIdx] ?? "—";
  const tipSeg = normalized[tipIdx];
  const tipInk =
    tipSeg?.color ??
    (tipSeg?.tone != null
      ? resolveChartToneColor(tipSeg.tone, palette)
      : TOKENS.color.content.muted);
  const tipPct = countSum > 0 ? (tipCount / countSum) * 100 : 0;
  const tipPctFmt = tipPct.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, borderRadius: TOKENS.radius.full }} role="img">
      <svg
        viewBox="0 0 100 100"
        style={{ width: "100%", height: "100%", display: "block" }}
        preserveAspectRatio="xMidYMid meet"
        aria-label={tooltip?.heading ?? "Composição"}
        onMouseLeave={tooltip ? clearHover : undefined}
      >
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
        />
        {ringPaths.map((item) => (
          <path
            key={item.key}
            d={item.d}
            fill="none"
            stroke={item.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              ...ringStyle,
              cursor: tooltip ? "default" : undefined,
              pointerEvents: tooltip ? "stroke" : undefined,
            }}
            onMouseEnter={(e) => {
              if (!tooltip) return;
              setPointer({ clientX: e.clientX, clientY: e.clientY, origIdx: item.origIdx });
            }}
            onMouseMove={(e) => {
              if (!tooltip) return;
              setPointer({ clientX: e.clientX, clientY: e.clientY, origIdx: item.origIdx });
            }}
          />
        ))}
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: TOKENS.spacing[6],
            fontFamily: TOKENS.typography.family.sans,
            ...(tooltip ? { pointerEvents: "none" as const } : {}),
          }}
        >
          {children}
        </div>
      )}
      {tooltip && (
        <FloatingTooltip open={showTip} anchorX={pointer?.clientX ?? 0} anchorY={pointer?.clientY ?? 0}>
          <Stack gap={TOKENS.spacing[4]}>
            <DataTooltipHeading>{tooltip.heading}</DataTooltipHeading>
            <DataTooltipMetricLine
              label={tipLabel}
              value={tipCount.toLocaleString("pt-BR")}
              ink={tipInk}
              meta={
                countSum > 0 ? (
                  <DataTooltipMetaSuffix>
                    {" "}
                    ({tipPctFmt}%)
                  </DataTooltipMetaSuffix>
                ) : undefined
              }
            />
          </Stack>
        </FloatingTooltip>
      )}
    </div>
  );
}
