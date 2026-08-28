import type { ChartSvgFrameTokens } from "./chartFrameTokens";
import { linearYTicks, maxYFromSeries } from "./chartScales";

export type GroupedColumnChartProps = {
  labels: ReadonlyArray<string>;
  primaryValues: ReadonlyArray<number>;
  secondaryValues: ReadonlyArray<number>;
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor: string;
  secondaryColor: string;
  frame: ChartSvgFrameTokens;
  height?: number;
  viewWidth?: number;
  ariaLabel?: string;
};

const formatValue = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);

export function GroupedColumnChart({
  labels,
  primaryValues,
  secondaryValues,
  primaryLabel,
  secondaryLabel,
  primaryColor,
  secondaryColor,
  frame,
  height = 260,
  viewWidth = 960,
  ariaLabel = "Gráfico de colunas comparativas",
}: GroupedColumnChartProps) {
  const count = Math.min(labels.length, primaryValues.length, secondaryValues.length);
  if (!count) return null;

  const visibleLabels = labels.slice(0, count);
  const primary = primaryValues.slice(0, count).map((value) => Math.max(0, value));
  const secondary = secondaryValues.slice(0, count).map((value) => Math.max(0, value));
  const padding = { top: 28, right: 18, bottom: 36, left: 48 };
  const chartWidth = viewWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + chartHeight;
  const maxY = maxYFromSeries([primary, secondary], 1);
  const ticks = linearYTicks(maxY, 5);
  const groupWidth = chartWidth / count;
  const barWidth = Math.max(16, Math.min(44, groupWidth * 0.25));
  const barGap = Math.max(8, Math.min(16, groupWidth * 0.08));
  const valueY = (value: number) => padding.top + chartHeight - (value / maxY) * chartHeight;

  const description = visibleLabels.map((label, index) => (
    `${label}: ${primaryLabel} ${formatValue(primary[index])}; ${secondaryLabel} ${formatValue(secondary[index])}`
  )).join(". ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${viewWidth} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height }}
    >
      <desc>{description}</desc>

      {ticks.map((tick) => {
        const y = valueY(tick);
        return (
          <g key={tick}>
            <line x1={padding.left} x2={viewWidth - padding.right} y1={y} y2={y} stroke={frame.gridLine} strokeWidth="1" />
            <text x={padding.left - 12} y={y + 4} textAnchor="end" fill={frame.textMuted} fontSize="12">{formatValue(tick)}</text>
          </g>
        );
      })}

      {visibleLabels.map((label, index) => {
        const center = padding.left + groupWidth * index + groupWidth / 2;
        const primaryX = center - barGap / 2 - barWidth;
        const secondaryX = center + barGap / 2;
        const primaryY = valueY(primary[index]);
        const secondaryY = valueY(secondary[index]);
        const primaryHeight = Math.max(0, baseline - primaryY);
        const secondaryHeight = Math.max(0, baseline - secondaryY);

        return (
          <g key={`${label}-${index}`}>
            <g aria-label={`${primaryLabel}: ${formatValue(primary[index])}`}>
              <title>{`${primaryLabel}: ${formatValue(primary[index])}`}</title>
              <rect x={primaryX} y={primaryY} width={barWidth} height={primaryHeight} rx="6" fill={primaryColor} />
              <text x={primaryX + barWidth / 2} y={Math.max(14, primaryY - 8)} textAnchor="middle" fill={frame.textPrimary} fontSize="13" fontWeight="700">
                {formatValue(primary[index])}
              </text>
            </g>
            <g aria-label={`${secondaryLabel}: ${formatValue(secondary[index])}`}>
              <title>{`${secondaryLabel}: ${formatValue(secondary[index])}`}</title>
              <rect x={secondaryX} y={secondaryY} width={barWidth} height={secondaryHeight} rx="6" fill={secondaryColor} />
              <text x={secondaryX + barWidth / 2} y={Math.max(14, secondaryY - 8)} textAnchor="middle" fill={frame.textPrimary} fontSize="13" fontWeight="700">
                {formatValue(secondary[index])}
              </text>
            </g>
            <text x={center} y={height - 10} textAnchor="middle" fill={frame.textMuted} fontSize="12">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}
