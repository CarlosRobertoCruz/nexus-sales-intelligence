import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts-liquidfill";

import { TOKENS } from "@/garden/tokens";

/** Formas nativas da lib + `storage` (cilindro custom via path). */
export type LiquidFillShape = "circle" | "rect" | "roundRect" | "storage";

type LiquidFillChartProps = {
  /** 0–100 */
  percentage: number;
  color: string;
  trackColor: string;
  size?: number;
  /** Texto no centro; default = `${percentage}%` arredondado / com 1 casa se < 10 */
  label?: string;
  outlineColor?: string;
  amplitude?: number;
  shape?: LiquidFillShape;
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

function defaultLabel(percentage: number): string {
  if (percentage > 0 && percentage < 10) return `${percentage.toFixed(1)}%`;
  return `${Math.round(percentage)}%`;
}

/** Silhueta de tanque/storage (cápsula vertical) — path SVG pro echarts-liquidfill. */
const STORAGE_SHAPE_PATH =
  "path://M34,22A16,10 0 0 1 66,22L66,78A16,10 0 0 1 34,78Z";

function resolveShape(shape: LiquidFillShape): string {
  if (shape === "storage") return STORAGE_SHAPE_PATH;
  return shape;
}

/**
 * Tanque com líquido animado (echarts-liquidfill).
 * Cores e tamanho vêm de fora — garden só encapsula a lib.
 */
export function LiquidFillChart({
  percentage,
  color,
  trackColor,
  size = 120,
  label,
  outlineColor,
  amplitude,
  shape = "circle",
}: LiquidFillChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const p = clampPct(percentage);
  const centerLabel = label ?? defaultLabel(p);
  const ring = outlineColor ?? color;
  const resolvedShape = resolveShape(shape);
  const waveAmplitude = amplitude ?? (p < 12 ? 2 : 5);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.setOption(
      {
        series: [
          {
            type: "liquidFill",
            data: [p / 100],
            shape: resolvedShape,
            radius: shape === "storage" ? "78%" : "88%",
            center: ["50%", "50%"],
            color: [color],
            backgroundStyle: {
              color: trackColor,
              borderWidth: 0,
            },
            outline: {
              show: true,
              borderDistance: shape === "storage" ? 2 : 3,
              itemStyle: {
                borderWidth: 2,
                borderColor: ring,
                shadowBlur: 0,
              },
            },
            itemStyle: {
              shadowBlur: 0,
              opacity: 0.95,
            },
            label: {
              show: true,
              formatter: () => centerLabel,
              fontSize: size >= 120 ? 16 : 14,
              fontWeight: TOKENS.typography.weight[700],
              fontFamily: TOKENS.typography.family.sans,
              color: TOKENS.color.content.primary,
              position: "inside",
            },
            amplitude: waveAmplitude,
            waveAnimation: true,
            animationDuration: 1200,
            animationDurationUpdate: 800,
          },
        ],
      },
      { notMerge: true },
    );
  }, [p, color, trackColor, ring, centerLabel, size, waveAmplitude, resolvedShape, shape]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={centerLabel}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    />
  );
}
