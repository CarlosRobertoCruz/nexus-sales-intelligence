import { TOKENS } from "@/garden/tokens";
import type { CSSProperties } from "react";

const DEFAULT_PROGRESS_FILL = `linear-gradient(90deg, ${TOKENS.color.brand.primary}, ${TOKENS.color.brand.borderMuted})`;

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: CSSProperties["height"];
  trackColor?: string;
  fillColor?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ProgressBar({
  value,
  max = 100,
  height = TOKENS.size[10],
  trackColor = TOKENS.color.surface.subtle,
  fillColor = DEFAULT_PROGRESS_FILL,
  style,
  ariaLabel = "Progresso",
}: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percent = clamp((value / safeMax) * 100, 0, 100);

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamp(value, 0, safeMax)}
      style={{
        width: "100%",
        height,
        borderRadius: TOKENS.radius.full,
        background: trackColor,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          height: "100%",
          width: `${percent}%`,
          background: fillColor,
        }}
      />
    </div>
  );
}
