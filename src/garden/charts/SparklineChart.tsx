import { useCallback, useId, useRef, useState, type MouseEvent } from "react";

import { DataTooltipHeading, DataTooltipMetricLine, FloatingTooltip, Stack } from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";

export type SparklineChartTooltipProps = {
  /** Rótulo da métrica na linha (ex.: título do KPI). */
  metricLabel: string;
  /** Opcional: rótulos por ponto (`points.length`). */
  pointLabels?: readonly string[];
  formatPointValue: (value: number, index: number) => string;
};

type SparklineChartProps = {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
  strokeWidth?: number;
  /** Bolinha no último ponto (KPI cards). */
  showEndDot?: boolean;
  tooltip?: SparklineChartTooltipProps;
};

const DEFAULT_WIDTH = 90;
const DEFAULT_HEIGHT = 30;

function nearestSparkIndex(clientX: number, rect: DOMRect, pointCount: number): number {
  if (pointCount <= 1) {
    return 0;
  }
  const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const clamped = Math.max(0, Math.min(1, frac));
  return Math.round(clamped * (pointCount - 1));
}

export function SparklineChart({
  points,
  color,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  strokeOpacity = 1,
  fillOpacity = 0.45,
  strokeWidth = 2,
  showEndDot = false,
  tooltip,
}: SparklineChartProps) {
  const id = useId().replaceAll(":", "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ clientX: number; clientY: number; index: number } | null>(null);

  const clearHover = useCallback(() => {
    setHover(null);
  }, []);

  const handlePointer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!tooltip) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const index = nearestSparkIndex(event.clientX, rect, points.length);
      setHover({ clientX: event.clientX, clientY: event.clientY, index });
    },
    [tooltip, points.length],
  );

  if (points.length === 0) {
    return null;
  }

  let pathD = "";
  let areaD = "";
  let endDot: { x: number; y: number } | null = null;

  if (points.length === 1) {
    pathD = `M 0 ${height * 0.5} L ${width} ${height * 0.5}`;
    endDot = { x: width, y: height * 0.5 };
  } else {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    const pad = 2;
    const innerH = height - pad * 2;
    const step = width / (points.length - 1);
    const normalize = (v: number) => (range ? (v - min) / range : 0.5) * innerH;
    const coords = points.map((v, i) => {
      const x = i * step;
      const y = height - pad - normalize(v);
      return { x, y };
    });
    pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    areaD = [
      "M 0 " + (height - pad),
      ...coords.map((c) => `L ${c.x} ${c.y}`),
      `L ${width} ${height - pad} Z`,
    ].join(" ");
    endDot = coords[coords.length - 1] ?? null;
  }

  const svg = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {points.length > 1 ? (
        <>
          <defs>
            <linearGradient id={`${id}spark`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${id}spark)`} />
        </>
      ) : null}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showEndDot && endDot ? (
        <circle cx={endDot.x} cy={endDot.y} r={3} fill={color} stroke={color} strokeWidth={1} />
      ) : null}
    </svg>
  );

  const showTip = tooltip != null && hover != null && points.length > 0;
  const hi = hover?.index ?? 0;
  const headingText =
    tooltip != null
      ? (tooltip.pointLabels != null &&
          tooltip.pointLabels[hi] != null &&
          String(tooltip.pointLabels[hi]).trim() !== ""
          ? tooltip.pointLabels[hi]
          : `${hi + 1}/${points.length}`)
      : "";

  const valueAt = points[hi] ?? points[points.length - 1];

  return (
    <>
      <div
        ref={containerRef}
        role={tooltip ? "img" : undefined}
        aria-label={tooltip?.metricLabel}
        onMouseEnter={tooltip ? handlePointer : undefined}
        onMouseMove={tooltip ? handlePointer : undefined}
        onMouseLeave={tooltip ? clearHover : undefined}
        style={{
          display: "inline-block",
          lineHeight: 0,
          ...(tooltip ? { cursor: "crosshair" as const } : {}),
        }}
      >
        {svg}
      </div>
      {tooltip && (
        <FloatingTooltip open={showTip} anchorX={hover?.clientX ?? 0} anchorY={hover?.clientY ?? 0}>
          <Stack gap={TOKENS.spacing[4]}>
            <DataTooltipHeading>{headingText}</DataTooltipHeading>
            <DataTooltipMetricLine
              label={tooltip.metricLabel}
              value={tooltip.formatPointValue(valueAt, hi)}
              ink={color}
            />
          </Stack>
        </FloatingTooltip>
      )}
    </>
  );
}
