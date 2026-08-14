import { useId, useState, useCallback, type MouseEvent } from "react";
import { TOKENS } from "@/garden/tokens";
import { DataTooltipHeading, DataTooltipMetricLine, FloatingTooltip, Stack } from "@/garden/foundations";

import type { ChartSvgFrameTokens } from "./chartFrameTokens";
import { linearYTicks, maxYFromSeries, xLabelIndexSet } from "./chartScales";

type DualAreaLineChartProps = {
  labels: string[];
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
  frame: ChartSvgFrameTokens;
  seriesALabel: string;
  seriesBLabel: string;
  viewWidth?: number;
  height?: number;
  yTickCount?: number;
  maxXLabels?: number;
  /** ID do no visivel que nomeia o grafico (titulo/regiao); alternativa a ariaLabel isolada. */
  ariaLabelledBy?: string;
  /** Fallback quando `ariaLabelledBy` esta vazio ou ausente. */
  ariaLabel?: string;
  ariaDescribedBy?: string;
};

const DEFAULT_VIEW_W = 460;
const DEFAULT_H = 150;
const DEFAULT_CHART_ARIA_LABEL = "Gráfico de linhas; passe o mouse para ver valores";

type HoverState = { index: number; x: number; y: number };

/**
 * Duas séries (área + linha). Cruz e tooltip (foundation `FloatingTooltip`) no ponto mais próximo do mouse.
 */
export function DualAreaLineChart({
  labels,
  seriesA,
  seriesB,
  colorA,
  colorB,
  frame,
  seriesALabel,
  seriesBLabel,
  viewWidth = DEFAULT_VIEW_W,
  height = DEFAULT_H,
  yTickCount = 6,
  maxXLabels = 7,
  ariaLabelledBy,
  ariaLabel,
  ariaDescribedBy,
}: DualAreaLineChartProps) {
  const gid = useId().replaceAll(":", "");
  const [hover, setHover] = useState<HoverState | null>(null);

  const m = Math.min(labels.length, seriesA.length, seriesB.length);

  const paddingLeft = 28;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 22;
  const chartWidth = viewWidth - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const onChartPointer = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      if (m < 1) {
        return;
      }
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) {
        return;
      }
      const { left, width: w } = svg.getBoundingClientRect();
      const xSvg = ((e.clientX - left) / w) * viewWidth;
      if (xSvg < paddingLeft || xSvg > paddingLeft + chartWidth) {
        setHover(null);
        return;
      }
      const t = (xSvg - paddingLeft) / chartWidth;
      const idx = m <= 1 ? 0 : Math.max(0, Math.min(m - 1, Math.round(t * (m - 1))));
      setHover({ index: idx, x: e.clientX, y: e.clientY });
    },
    [m, viewWidth, paddingLeft, chartWidth]
  );

  const clearHover = useCallback(() => {
    setHover(null);
  }, []);

  if (m === 0) {
    return null;
  }

  const a = seriesA.slice(0, m);
  const b = seriesB.slice(0, m);
  const lbl = labels.slice(0, m);
  const maxY = Math.max(1, maxYFromSeries([a, b], 1));
  const yTicks = linearYTicks(maxY, yTickCount);
  const xIdx = xLabelIndexSet(m, maxXLabels);
  const denom = m > 1 ? m - 1 : 1;

  const pta = (value: number, index: number): [number, number] => {
    const x = paddingLeft + (index / denom) * chartWidth;
    const y = paddingTop + chartHeight - (value / maxY) * chartHeight;
    return [x, y];
  };

  const lineOf = (series: number[], close: boolean) => {
    const pts = series.map((v, i) => pta(v, i));
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    if (!close) {
      return line;
    }
    const [lx] = pts[m - 1]!;
    const [fx] = pts[0]!;
    return `${line} L${lx} ${paddingTop + chartHeight} L${fx} ${paddingTop + chartHeight} Z`;
  };

  const hi = hover?.index;
  const crossX = hi != null ? pta(a[hi]!, hi)[0] : 0;
  const timeLabel = hi != null ? (lbl[hi] ?? "") : "";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewWidth} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        role="img"
        {...(ariaLabelledBy?.trim()
          ? { "aria-labelledby": ariaLabelledBy.trim() }
          : { "aria-label": ariaLabel ?? DEFAULT_CHART_ARIA_LABEL })}
        {...(ariaDescribedBy?.trim() ? { "aria-describedby": ariaDescribedBy.trim() } : {})}
      >
        <defs>
          <linearGradient id={`${gid}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorA} stopOpacity={0.22} />
            <stop offset="100%" stopColor={colorA} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gid}-b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorB} stopOpacity={0.22} />
            <stop offset="100%" stopColor={colorB} stopOpacity={0} />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = paddingTop + chartHeight - (tick / maxY) * chartHeight;
          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke={frame.gridLine}
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
              <text x={paddingLeft - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill={frame.textMuted}>
                {tick}
              </text>
            </g>
          );
        })}

        {lbl.map((label, j) =>
          xIdx.has(j) ? (
            <text
              key={`x-${j}`}
              x={pta(a[j]!, j)[0]}
              y={paddingTop + chartHeight + 14}
              textAnchor="middle"
              fontSize="9"
              fill={frame.textMuted}
            >
              {label}
            </text>
          ) : null
        )}

        <path d={lineOf(a, true)} fill={`url(#${gid}-a)`} />
        <path d={lineOf(b, true)} fill={`url(#${gid}-b)`} />
        <path d={lineOf(a, false)} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={lineOf(b, false)} fill="none" stroke={colorB} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {a.map((v, j) => {
          const [x, y] = pta(v, j);
          const on = hi === j;
          return <circle key={`d-${j}`} cx={x} cy={y} r={on ? 3.2 : 2.5} fill={colorA} opacity={1} />;
        })}

        {hi != null && (
          <line
            x1={crossX}
            y1={paddingTop}
            x2={crossX}
            y2={paddingTop + chartHeight}
            stroke={frame.textSubtle}
            strokeWidth={1}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}

        <rect
          x={paddingLeft}
          y={paddingTop}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onMouseMove={onChartPointer}
          onMouseEnter={onChartPointer}
          onMouseLeave={clearHover}
          style={{ cursor: "crosshair" }}
        />
      </svg>

      <FloatingTooltip open={hover != null} anchorX={hover?.x ?? 0} anchorY={hover?.y ?? 0}>
        <Stack gap={TOKENS.spacing[4]}>
          <DataTooltipHeading>{timeLabel}</DataTooltipHeading>
          {hi != null && (
            <>
              <DataTooltipMetricLine label={seriesALabel} value={a[hi]} ink={colorA} />
              <DataTooltipMetricLine label={seriesBLabel} value={b[hi]} ink={colorB} />
            </>
          )}
        </Stack>
      </FloatingTooltip>
    </div>
  );
}
