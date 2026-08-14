import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { TOKENS } from "@/garden/tokens";
import { DataTooltipHeading, DataTooltipMetricLine, FloatingTooltip, Stack } from "@/garden/foundations";
import type { ChartSvgFrameTokens } from "./chartFrameTokens";
import { linearYTicks, maxYFromSeries, xLabelIndexSet } from "./chartScales";

export type AreaLineChartExtraSeries = {
  label?: string;
  values: number[];
  color: string;
  /** Cor forte do texto da dica (rótulo + tom do valor); padrão = `color` do traço. */
  tooltipLabelInk?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  yAxis?: "primary" | "secondary";
};

type AreaLineChartProps = {
  labels: string[];
  series: number[];
  frame: ChartSvgFrameTokens;
  lineColor: string;
  seriesLabel?: string;
  extraSeries?: AreaLineChartExtraSeries[];
  viewWidth?: number;
  height?: number | string;
  yTickCount?: number;
  secondaryMax?: number;
  secondaryTickCount?: number;
  maxXLabels?: number;
  padding?: Partial<AreaLineChartPadding>;
  preserveAspectRatio?: string;
  axisFontSize?: number;
  lineOpacity?: number;
  extraLineOpacity?: number;
  areaOpacityStart?: number;
  areaOpacityEnd?: number;
  /**
   * Na dica, cor forte do nome da série principal (àrea) e do valor sobre o mesmo matiz (mais legível que `lineColor`).
   */
  tooltipPrimarySeriesInk?: string;
  /** Acessibilidade (`role="img"`): rótulo quando não há elemento visível com id. */
  "aria-label"?: string;
  /** Acessibilidade: id do elemento que nomeia o gráfico (ex.: título da secção). Se definido, prevalece sobre `aria-label`. */
  "aria-labelledby"?: string;
  /** Acessibilidade: ids (separados por espaço) de elementos que descrevem o gráfico (ex.: rótulos de eixos). */
  "aria-describedby"?: string;
};

type AreaLineChartPadding = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type Point = [number, number];
type HoverState = { index: number; x: number; y: number } | null;

const DEFAULT_VIEW_W = 1080;
const DEFAULT_H = 150;


function drawLine(ctx: CanvasRenderingContext2D, points: Point[]) {
  points.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
      return;
    }
    ctx.lineTo(x, y);
  });
}

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${color}${suffix}`;
}

export function AreaLineChart({
  labels,
  series,
  frame,
  lineColor,
  seriesLabel = "Valor",
  extraSeries = [],
  viewWidth = DEFAULT_VIEW_W,
  height = DEFAULT_H,
  yTickCount = 6,
  secondaryMax,
  secondaryTickCount = 5,
  maxXLabels = 12,
  padding,
  preserveAspectRatio: _preserveAspectRatio = "none",
  axisFontSize = 12,
  lineOpacity = 1,
  extraLineOpacity = 1,
  areaOpacityStart = 0.42,
  areaOpacityEnd = 0.06,
  tooltipPrimarySeriesInk,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: AreaLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState>(null);

  const handlePointer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || labels.length === 0 || series.length === 0) {
        setHover(null);
        return;
      }

      const n = Math.min(labels.length, series.length);
      const width = Math.max(1, container.clientWidth || viewWidth);
      const hasSecondaryAxis = extraSeries.some((item) => item.yAxis === "secondary");
      const chartPadding: AreaLineChartPadding = {
        left: padding?.left ?? 44,
        right: padding?.right ?? (hasSecondaryAxis ? 44 : 16),
        top: padding?.top ?? 18,
        bottom: padding?.bottom ?? 38,
      };
      const chartWidth = width - chartPadding.left - chartPadding.right;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;

      if (x < chartPadding.left || x > chartPadding.left + chartWidth) {
        setHover(null);
        return;
      }

      const t = (x - chartPadding.left) / chartWidth;
      const index = n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
      setHover({ index, x: event.clientX, y: event.clientY });
    },
    [extraSeries, labels.length, padding, series.length, viewWidth]
  );

  const clearHover = useCallback(() => {
    setHover(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || labels.length === 0 || series.length === 0) {
      return;
    }

    const render = () => {
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const width = Math.max(1, container.clientWidth || viewWidth);
      const numericHeight = typeof height === "number" ? height : container.clientHeight || DEFAULT_H;
      const canvasHeight = Math.max(1, numericHeight);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(canvasHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = typeof height === "number" ? `${height}px` : height;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, canvasHeight);
      context.font = `${axisFontSize}px ${TOKENS.typography.family.sans}`;
      context.textBaseline = "middle";

      const n = Math.min(labels.length, series.length);
      const s = series.slice(0, n);
      const lbl = labels.slice(0, n);
      const normalizedExtraSeries = extraSeries
        .map((item) => ({ ...item, values: item.values.slice(0, n) }))
        .filter((item) => item.values.length > 0);
      const primaryExtraSeries = normalizedExtraSeries
        .filter((item) => item.yAxis !== "secondary")
        .map((item) => item.values);
      const secondaryExtraSeries = normalizedExtraSeries
        .filter((item) => item.yAxis === "secondary")
        .map((item) => item.values);
      const hasSecondaryAxis = secondaryExtraSeries.length > 0;
      const maxY = Math.max(1, maxYFromSeries([s, ...primaryExtraSeries], 1));
      const maxSecondaryY = Math.max(
        1,
        secondaryMax ?? maxYFromSeries(secondaryExtraSeries, 1),
      );
      const yTicks = linearYTicks(maxY, yTickCount);
      const secondaryYTicks = hasSecondaryAxis
        ? linearYTicks(maxSecondaryY, secondaryTickCount)
        : [];
      const xIndices = xLabelIndexSet(n, maxXLabels);
      const hoverIndex = hover?.index;

      const chartPadding: AreaLineChartPadding = {
        left: padding?.left ?? 44,
        right: padding?.right ?? (hasSecondaryAxis ? 44 : 16),
        top: padding?.top ?? 18,
        bottom: padding?.bottom ?? 38,
      };
      const paddingLeft = chartPadding.left;
      const paddingRight = chartPadding.right;
      const paddingTop = chartPadding.top;
      const paddingBottom = chartPadding.bottom;
      const chartWidth = width - paddingLeft - paddingRight;
      const chartHeight = canvasHeight - paddingTop - paddingBottom;
      const denom = n > 1 ? n - 1 : 1;

      const pt = (value: number, index: number, yAxis: "primary" | "secondary" = "primary"): Point => {
        const x = paddingLeft + (index / denom) * chartWidth;
        const axisMax = yAxis === "secondary" ? maxSecondaryY : maxY;
        const y = paddingTop + chartHeight - (value / axisMax) * chartHeight;
        return [x, y];
      };

      context.strokeStyle = frame.gridLine;
      context.lineWidth = 1;
      context.setLineDash([]);
      context.fillStyle = frame.textMuted;

      yTicks.forEach((tick) => {
        const y = paddingTop + chartHeight - (tick / maxY) * chartHeight;
        context.beginPath();
        context.moveTo(paddingLeft, y);
        context.lineTo(paddingLeft + chartWidth, y);
        context.stroke();
        context.textAlign = "right";
        context.fillText(String(tick), paddingLeft - 12, y);
      });

      secondaryYTicks.forEach((tick) => {
        const y = paddingTop + chartHeight - (tick / maxSecondaryY) * chartHeight;
        context.textAlign = "left";
        context.fillText(String(tick), paddingLeft + chartWidth + 12, y);
      });

      lbl.forEach((label, index) => {
        if (!xIndices.has(index)) {
          return;
        }
        context.textAlign = "center";
        const xAxisLabelY = Math.min(
          canvasHeight - axisFontSize * 0.35,
          paddingTop + chartHeight + Math.max(axisFontSize, paddingBottom) / 2,
        );
        const xIdeal = pt(s[index]!, index)[0];
        const labelWidth = context.measureText(label).width;
        const halfW = labelWidth / 2;
        const xMin = paddingLeft + halfW + 1;
        const xMax = width - paddingRight - halfW - 1;
        const x = xMin <= xMax ? Math.max(xMin, Math.min(xMax, xIdeal)) : xIdeal;
        context.fillText(label, x, xAxisLabelY);
      });

      const mainPoints = s.map((value, index) => pt(value, index));
      const first = mainPoints[0]!;
      const last = mainPoints[mainPoints.length - 1]!;
      const gradient = context.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      gradient.addColorStop(0, withAlpha(lineColor, areaOpacityStart));
      gradient.addColorStop(1, withAlpha(lineColor, areaOpacityEnd));

      context.beginPath();
      drawLine(context, mainPoints);
      context.lineTo(last[0], paddingTop + chartHeight);
      context.lineTo(first[0], paddingTop + chartHeight);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();

      context.beginPath();
      drawLine(context, mainPoints);
      context.strokeStyle = lineColor;
      context.lineWidth = 3;
      context.globalAlpha = lineOpacity;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke();
      context.globalAlpha = 1;

      normalizedExtraSeries.forEach((item) => {
        const points = item.values.map((value, index) => pt(value, index, item.yAxis));
        context.beginPath();
        drawLine(context, points);
        context.strokeStyle = item.color;
        context.lineWidth = item.strokeWidth ?? 2;
        context.globalAlpha = extraLineOpacity;
        context.setLineDash(item.strokeDasharray ? item.strokeDasharray.split(" ").map(Number) : []);
        context.stroke();
        context.globalAlpha = 1;
      });
      context.setLineDash([]);

      if (hoverIndex != null && hoverIndex >= 0 && hoverIndex < n) {
        const activeX = pt(s[hoverIndex]!, hoverIndex)[0];
        context.beginPath();
        context.moveTo(activeX, paddingTop);
        context.lineTo(activeX, paddingTop + chartHeight);
        context.strokeStyle = frame.textSubtle;
        context.lineWidth = 1;
        context.setLineDash([3, 2]);
        context.stroke();
        context.setLineDash([]);

        const activePoints = [
          { point: pt(s[hoverIndex]!, hoverIndex), color: lineColor, radius: 3.5 },
          ...normalizedExtraSeries.map((item) => ({
            point: pt(item.values[hoverIndex]!, hoverIndex, item.yAxis),
            color: item.color,
            radius: 3,
          })),
        ];

        activePoints.forEach(({ point: [x, y], color, radius }) => {
          context.beginPath();
          context.arc(x, y, radius + 2, 0, Math.PI * 2);
          context.fillStyle = TOKENS.color.surface.base;
          context.fill();
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = color;
          context.fill();
        });
      }
    };

    render();

    let resizeRaf = 0;
    const scheduleRender = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        render();
      });
    };

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(resizeRaf);
      observer.disconnect();
    };
  }, [
    axisFontSize,
    extraSeries,
    frame.gridLine,
    frame.textMuted,
    frame.textSubtle,
    height,
    hover,
    lineOpacity,
    extraLineOpacity,
    areaOpacityStart,
    areaOpacityEnd,
    labels,
    lineColor,
    maxXLabels,
    padding,
    secondaryMax,
    secondaryTickCount,
    series,
    viewWidth,
    yTickCount,
  ]);

  if (labels.length === 0 || series.length === 0) {
    return null;
  }

  const primarySeriesTooltipInk = tooltipPrimarySeriesInk ?? lineColor;

  const chartA11y = {
    ...(ariaLabelledBy != null && ariaLabelledBy !== ""
      ? ({ "aria-labelledby": ariaLabelledBy } as const)
      : ariaLabel != null && ariaLabel !== ""
        ? ({ "aria-label": ariaLabel } as const)
        : {}),
    ...(ariaDescribedBy != null && ariaDescribedBy !== ""
      ? ({ "aria-describedby": ariaDescribedBy } as const)
      : {}),
  };

  return (
    <>
      <div
        ref={containerRef}
        role="img"
        {...chartA11y}
        onMouseMove={handlePointer}
        onMouseEnter={handlePointer}
        onMouseLeave={clearHover}
        style={{
          display: "block",
          width: "100%",
          height,
          minHeight: typeof height === "number" ? height : DEFAULT_H,
          cursor: "crosshair",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height }} />
      </div>
      <FloatingTooltip open={hover != null} anchorX={hover?.x ?? 0} anchorY={hover?.y ?? 0}>
        <Stack gap={TOKENS.spacing[4]}>
          <DataTooltipHeading>{hover != null ? labels[hover.index] : ""}</DataTooltipHeading>
          {hover != null && (
            <>
              <DataTooltipMetricLine label={seriesLabel} value={series[hover.index]} ink={primarySeriesTooltipInk} />
              {extraSeries.map((item, index) => {
                const rowInk = item.tooltipLabelInk ?? item.color;
                return (
                  <DataTooltipMetricLine
                    key={index}
                    label={item.label ?? `Série ${index + 2}`}
                    value={item.values[hover.index]}
                    ink={rowInk}
                  />
                );
              })}
            </>
          )}
        </Stack>
      </FloatingTooltip>
    </>
  );
}
