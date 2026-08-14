/**
 * Colunas verticais com barras em cápsula (pill).
 * Cores default: `brand.borderMuted` (brand médio, opaco, abaixo do primary) e `brand.primary` no pico.
 */

import type { CSSProperties } from "react";
import { Row, Stack, Text, Tooltip } from "@/garden/foundations";
import { TOKENS } from "@/garden/tokens";

export type PillColumnBarChartPoint = {
  label: string;
  value: number;
};

export type PillColumnBarChartProps = {
  points: ReadonlyArray<PillColumnBarChartPoint>;
  /** Texto do tooltip ao pairar na barra. */
  formatTooltip: (label: string, value: number) => string;
  /** Altura da faixa onde as barras crescem (rótulos ficam abaixo). */
  chartHeight?: number;
  /** Altura máxima da coluna preenchida (px). */
  maxBarHeight?: number;
  /** Altura mínima da barra para valores > 0 muito baixos (px). */
  minBarHeight?: number;
  /** Largura fixa de cada barra (ex.: `TOKENS.size[20]`). */
  barWidth?: string;
  /** Raio da barra; `TOKENS.radius.full` = cápsula. */
  barRadius?: string;
  /** Espaço entre colunas. */
  columnGap?: string;
  /** Espaço entre barra e rótulo do eixo. */
  labelGap?: string;
  /** Colunas fora do pico. Default: `TOKENS.color.brand.borderMuted`. */
  fillDefault?: string;
  /** Coluna(s) no valor máximo da série. Default: `TOKENS.color.brand.primary`. */
  fillPeak?: string;
  /** `aria-label` do bloco do gráfico (recomendado). */
  ariaLabel?: string;
  style?: CSSProperties;
};

export function PillColumnBarChart({
  points,
  formatTooltip,
  chartHeight = 240,
  maxBarHeight = 210,
  minBarHeight = 12,
  barWidth = TOKENS.size[20],
  barRadius = TOKENS.radius.full,
  columnGap = TOKENS.spacing[6],
  labelGap = TOKENS.spacing[10],
  fillDefault = TOKENS.color.brand.borderMuted,
  fillPeak = TOKENS.color.brand.primary,
  ariaLabel,
  style,
}: PillColumnBarChartProps) {
  const maxY = Math.max(1, ...points.map((p) => p.value));

  return (
    <Stack
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      style={{ gap: TOKENS.spacing[12], minWidth: 0, ...style }}
    >
      <Row align="flex-end" style={{ gap: columnGap, height: chartHeight, minWidth: 0 }}>
        {points.map((point) => {
          const height = Math.max(minBarHeight, (point.value / maxY) * maxBarHeight);
          const isPeak = point.value === maxY;

          return (
            <Stack
              key={point.label}
              align="center"
              style={{ flex: "1 1 0", gap: labelGap, minWidth: 0 }}
            >
              <Tooltip
                label={formatTooltip(point.label, point.value)}
                wrapperStyle={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  minHeight: maxBarHeight,
                }}
              >
                <div
                  style={{
                    width: barWidth,
                    minWidth: barWidth,
                    height,
                    borderRadius: barRadius,
                    background: isPeak ? fillPeak : fillDefault,
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
              <Text size="xs" tone="muted">
                {point.label}
              </Text>
            </Stack>
          );
        })}
      </Row>
    </Stack>
  );
}
