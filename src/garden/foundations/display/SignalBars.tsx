/**
 * Foundation — ícone de barras de sinal (1–5), domain-blind.
 * Cores e tamanho vêm do consumer via props.
 */
import type { CSSProperties } from "react";

export interface SignalBarsProps {
  bars: 1 | 2 | 3 | 4 | 5;
  color: string;
  mutedColor: string;
  size?: number;
}

const BAR_HEIGHTS = [3, 5.5, 8, 10.5, 13] as const;

export function SignalBars({ bars, color, mutedColor, size = 14 }: SignalBarsProps) {
  const width = size;
  const height = size;
  const barWidth = 1.8;
  const gap = 1.3;
  const totalBarsWidth = BAR_HEIGHTS.length * barWidth + (BAR_HEIGHTS.length - 1) * gap;
  const startX = (width - totalBarsWidth) / 2;
  const baseline = height - 1;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ display: "block", flexShrink: 0 } satisfies CSSProperties}
    >
      {BAR_HEIGHTS.map((barHeight, index) => {
        const active = index < bars;
        const x = startX + index * (barWidth + gap);
        const y = baseline - barHeight;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={0.6}
            fill={active ? color : mutedColor}
          />
        );
      })}
    </svg>
  );
}
