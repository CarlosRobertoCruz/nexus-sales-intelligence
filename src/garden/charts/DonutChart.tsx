import { useCallback, useState } from "react";
import { DataTooltipHeading, DataTooltipMetricLine, FloatingTooltip, Stack } from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";

export type DonutChartTooltipProps = {
  heading: string;
  metricLabel?: string;
  formatValue?: (percentage: number) => string;
};

type DonutChartProps = {
  percentage: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Tamanho do texto no centro; use número em px (ex. 19 / 24) ou preset. */
  labelSize?: "sm" | "md" | "lg" | 19 | 24;
  tooltip?: DonutChartTooltipProps;
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const labelFontSize: Record<"sm" | "md" | "lg", number> = {
  sm: 11,
  md: 16,
  lg: 18,
};

/**
 * Anel de progresso (porcentagem). Cores vêm de fora; `trackColor` = fundo do anel.
 */
export function DonutChart({
  percentage,
  color,
  trackColor,
  size = 96,
  strokeWidth = 6,
  label,
  labelSize = "md",
  tooltip,
}: DonutChartProps) {
  const [hover, setHover] = useState<{ clientX: number; clientY: number } | null>(null);
  const clearHover = useCallback(() => setHover(null), []);
  const p = clampPct(percentage);
  const centerFont =
    labelSize === 19 || labelSize === 24 ? labelSize : labelFontSize[labelSize];
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (p / 100) * circumference;
  const viewBox = "0 0 100 100";
  const showTooltip = tooltip != null && hover != null;
  const tooltipValue = tooltip?.formatValue?.(p) ?? `${Math.round(p)}%`;
  return (
    <>
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
          ...(tooltip ? { cursor: "crosshair" as const } : {}),
        }}
        aria-label={label}
        onMouseEnter={(event) => {
          if (!tooltip) return;
          setHover({ clientX: event.clientX, clientY: event.clientY });
        }}
        onMouseMove={(event) => {
          if (!tooltip) return;
          setHover({ clientX: event.clientX, clientY: event.clientY });
        }}
        onMouseLeave={tooltip ? clearHover : undefined}
      >
      <svg width="100%" height="100%" viewBox={viewBox} role="img">
        <circle cx="50" cy="50" r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: centerFont,
            fontWeight: TOKENS.typography.weight[800],
            lineHeight: 1,
            color,
            textAlign: "center",
            paddingTop: 1,
            fontFamily: TOKENS.typography.family.sans,
          }}
        >
          {label}
        </div>
      )}
      </div>
      {tooltip && (
        <FloatingTooltip open={showTooltip} anchorX={hover?.clientX ?? 0} anchorY={hover?.clientY ?? 0}>
          <Stack gap={TOKENS.spacing[4]}>
            <DataTooltipHeading>{tooltip.heading}</DataTooltipHeading>
            <DataTooltipMetricLine
              label={tooltip.metricLabel ?? "Percentual"}
              value={tooltipValue}
              ink={color}
            />
          </Stack>
        </FloatingTooltip>
      )}
    </>
  );
}
