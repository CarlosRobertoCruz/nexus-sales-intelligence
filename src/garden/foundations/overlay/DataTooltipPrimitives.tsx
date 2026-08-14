/**
 * Tipografia consistente para conteúdo de tooltips flutuantes focados em dados (gráficos, comparativos).
 * Usar dentro de `FloatingTooltip`; não renderiza backdrop nem âncoras.
 */

import type { ReactNode } from "react";

import { TOKENS } from "@/garden/tokens";

export function DataTooltipHeading({ children }: { children: ReactNode }) {
  return (
    <strong
      style={{
        display: "block",
        fontFamily: TOKENS.typography.family.sans,
        fontSize: TOKENS.typography.size[12],
        fontWeight: TOKENS.typography.weight[800],
        color: TOKENS.color.brand.primary,
      }}
    >
      {children}
    </strong>
  );
}

export function DataTooltipMetricLine({
  label,
  value,
  ink,
  meta,
}: {
  label: ReactNode;
  value: ReactNode;
  ink: string;
  meta?: ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: TOKENS.typography.size[12],
        lineHeight: TOKENS.typography.lineHeight[1.4],
        fontFamily: TOKENS.typography.family.sans,
      }}
    >
      <strong
        style={{
          fontFamily: TOKENS.typography.family.sans,
          fontWeight: TOKENS.typography.weight[700],
          color: ink,
        }}
      >
        {label}{" "}
      </strong>
      <span
        style={{
          color: ink,
          opacity: TOKENS.effects.opacity[78],
          fontWeight: TOKENS.typography.weight[500],
          fontSize: TOKENS.typography.size[12],
          fontFamily: TOKENS.typography.family.sans,
        }}
      >
        {value}
      </span>
      {meta ?? null}
    </div>
  );
}

export function DataTooltipMetaSuffix({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: TOKENS.typography.family.sans,
        fontWeight: TOKENS.typography.weight[400],
        color: TOKENS.color.content.muted,
        fontSize: TOKENS.typography.size[11],
      }}
    >
      {children}
    </span>
  );
}
