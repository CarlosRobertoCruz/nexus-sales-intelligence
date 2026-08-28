/**
 * Gráficos do garden — reutilizáveis em qualquer app que use `@/garden/tokens`.
 * Maioria em SVG leve; `LiquidFillChart` usa echarts-liquidfill (canvas).
 */
export { AreaLineChart } from "./AreaLineChart";
export { DualAreaLineChart } from "./DualAreaLineChart";
export { GroupedColumnChart } from "./GroupedColumnChart";
export type { GroupedColumnChartProps } from "./GroupedColumnChart";
export { DonutChart } from "./DonutChart";
export { MultiDonutChart } from "./MultiDonutChart";
export type { MultiDonutChartTooltipProps } from "./MultiDonutChart";
export { LiquidFillChart } from "./LiquidFillChart";
export type { LiquidFillShape } from "./LiquidFillChart";
export { PillColumnBarChart } from "./PillColumnBarChart";
export type { PillColumnBarChartPoint, PillColumnBarChartProps } from "./PillColumnBarChart";
export { SparklineChart } from "./SparklineChart";
export type { SparklineChartTooltipProps } from "./SparklineChart";
export { sparklineKpi } from "./sparklineKpi";
export { StackedBarChart } from "./StackedBarChart";
export type { StackedBarChartTooltipProps, StackedBarSegment } from "./StackedBarChart";
export { TrapezoidFunnelChart } from "./TrapezoidFunnelChart";
export type { TrapezoidFunnelChartLayer, TrapezoidFunnelChartProps } from "./TrapezoidFunnelChart";
export { resolveChartToneColor } from "./chartPalettes";
export type { ChartPalette, ChartTone } from "./chartPalettes";
export type { ChartSvgFrameTokens } from "./chartFrameTokens";
export { argMax, linearYTicks, maxYFromSeries, niceCeil } from "./chartScales";
