/**
 * Foundation — faixa de barras decorativas (domain-blind).
 * Usada como ornamentação visual em cards/KPIs; não representa série de dados.
 * Cor, alturas e medidas vêm do consumer via props.
 */
import type { CSSProperties } from "react";

import Row from "../layout/Row";

/** Alturas padrão (px) — padrão visual genérico, sem significado de domínio. */
const DECORATIVE_BARS_DEFAULT_HEIGHTS = [
  10, 17, 12, 26, 18, 32, 14, 24, 38, 20, 30, 42, 24, 34, 18, 28, 14, 22,
] as const;

export interface DecorativeBarsProps {
  /** Cor de preenchimento das barras (token do consumer). */
  color: string;
  /** Alturas em px de cada barra. Default: DECORATIVE_BARS_DEFAULT_HEIGHTS. */
  heights?: readonly number[];
  /** Altura do container em px. Default: 44. */
  height?: number;
  /** Largura de cada barra em px. Default: 3. */
  barWidth?: number;
  /** Gap entre barras em px. Default: 2. */
  gap?: number;
  style?: CSSProperties;
}

export function DecorativeBars({
  color,
  heights = DECORATIVE_BARS_DEFAULT_HEIGHTS,
  height = 44,
  barWidth = 3,
  gap = 2,
  style,
}: DecorativeBarsProps) {
  return (
    <Row align="end" gap={gap} aria-hidden style={{ height, ...style }}>
      {heights.map((barHeight, index) => (
        <span
          key={`${barHeight}-${index}`}
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: 2,
            background: color,
            opacity: 0.45 + (index % 4) * 0.16,
          }}
        />
      ))}
    </Row>
  );
}
