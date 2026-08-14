import type { CSSProperties } from "react";
import { useState } from "react";
import { TOKENS } from "@/garden/tokens";

export type TrapezoidFunnelChartLayer = {
  value: string;
  label: string;
  fillColor: string;
  /** Cor ao passar o rato sobre o segmento (opcional). */
  hoverFillColor?: string;
  /** Largura do topo do segmento (px na escala do `viewBox`). A base = topo do segmento seguinte; no último, base = topo × `lastBottomWidthFactor`. */
  topWidth: number;
};

export type TrapezoidFunnelChartProps = {
  layers: TrapezoidFunnelChartLayer[];
  /** Altura de cada trapézio em px (escala do viewBox). */
  layerHeightPx?: number;
  /** Espaço vertical entre segmentos (faixa “branca” entre etapas). */
  gapPx?: number;
  /** Padding horizontal em torno do funil mais largo. */
  horizontalPadPx?: number;
  /** Padding vertical no topo e na base do SVG. */
  verticalPadPx?: number;
  /** Largura da base do último segmento como fração do seu topo (0–1). */
  lastBottomWidthFactor?: number;
  /** Escala o SVG para preencher altura (e largura disponível) do pai em layout flex. */
  fillParent?: boolean;
  "aria-label"?: string;
};

function pxFromTokenSize(key: keyof typeof TOKENS.typography.size): number {
  return Number.parseInt(String(TOKENS.typography.size[key]).replace("px", ""), 10);
}

/**
 * Funil em etapas: cada trapézio encaixa na base do de cima (largura do topo = largura da base do anterior).
 * Cores e rótulos vêm das props; sem semântica de domínio.
 */
export function TrapezoidFunnelChart({
  layers,
  layerHeightPx = 52,
  gapPx = 6,
  horizontalPadPx = 28,
  verticalPadPx = 6,
  lastBottomWidthFactor = 0.74,
  fillParent = false,
  "aria-label": ariaLabel = "Funil por etapas",
}: TrapezoidFunnelChartProps) {
  const [hoveredLayerIndex, setHoveredLayerIndex] = useState<number | null>(null);

  if (layers.length === 0) {
    return null;
  }

  const maxTop = Math.max(1, ...layers.map((l) => l.topWidth));
  const vbW = maxTop + horizontalPadPx * 2;
  const cx = vbW / 2;
  const n = layers.length;
  const totalH = verticalPadPx * 2 + n * layerHeightPx + Math.max(0, n - 1) * gapPx;

  const valueFs = pxFromTokenSize(19);
  const labelFs = pxFromTokenSize(13);
  const ink = TOKENS.color.content.primary;

  const polygons: { key: string; points: string; layerIndex: number }[] = [];
  const labels: { key: string; yValue: number; yLabel: number; value: string; label: string }[] = [];

  let y = verticalPadPx;
  for (let i = 0; i < n; i++) {
    const topW = layers[i].topWidth;
    const botW = i < n - 1 ? layers[i + 1].topWidth : topW * lastBottomWidthFactor;
    const y0 = y;
    const y1 = y + layerHeightPx;
    const x0 = cx - topW / 2;
    const x1 = cx + topW / 2;
    const x2 = cx + botW / 2;
    const x3 = cx - botW / 2;
    const points = `${x0},${y0} ${x1},${y0} ${x2},${y1} ${x3},${y1}`;
    polygons.push({ key: `seg-${i}`, points, layerIndex: i });
    labels.push({
      key: `lbl-${i}`,
      yValue: y0 + layerHeightPx * 0.38,
      yLabel: y0 + layerHeightPx * 0.72,
      value: layers[i].value,
      label: layers[i].label,
    });
    y += layerHeightPx + gapPx;
  }

  const intrinsicSvgStyle: CSSProperties = {
    display: "block",
    maxWidth: `${vbW}px`,
    marginLeft: "auto",
    marginRight: "auto",
    fontFamily: TOKENS.typography.family.sans,
  };

  const fillSvgStyle: CSSProperties = {
    display: "block",
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    marginLeft: "auto",
    marginRight: "auto",
    fontFamily: TOKENS.typography.family.sans,
  };

  return (
    <svg
      viewBox={`0 0 ${vbW} ${totalH}`}
      width="100%"
      height={fillParent ? "100%" : undefined}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
      style={fillParent ? fillSvgStyle : intrinsicSvgStyle}
    >
      {polygons.map((p) => {
        const layer = layers[p.layerIndex];
        const hover = layer.hoverFillColor;
        const isHover = hoveredLayerIndex === p.layerIndex;
        const fill = isHover && hover !== undefined ? hover : layer.fillColor;
        return (
          <polygon
            key={p.key}
            points={p.points}
            fill={fill}
            style={{
              transition:
                hover !== undefined
                  ? `fill ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.standard}`
                  : undefined,
            }}
            onMouseEnter={() => {
              if (hover !== undefined) setHoveredLayerIndex(p.layerIndex);
            }}
            onMouseLeave={() => setHoveredLayerIndex(null)}
          />
        );
      })}
      <g style={{ pointerEvents: "none" }}>
        {labels.map((t) => (
          <g key={t.key}>
            <text
              x={cx}
              y={t.yValue}
              textAnchor="middle"
              fill={ink}
              fontSize={valueFs}
              fontWeight={TOKENS.typography.weight[700]}
            >
              {t.value}
            </text>
            <text
              x={cx}
              y={t.yLabel}
              textAnchor="middle"
              fill={ink}
              fontSize={labelFs}
              fontWeight={TOKENS.typography.weight[600]}
            >
              {t.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
