/**
 * Foundation - bloco de shimmer para skeleton screen.
 *
 * Representa conteudo a carregar com uma animacao de brilho deslizante.
 * O shimmer usa tokens diretamente para evitar dependencia de CSS globals.
 *
 * width, height e radius aceitam qualquer valor CSS valido ou token direto.
 * Puramente visual, sem semantica externa.
 */

import type { CSSProperties } from "react";
import { TOKENS } from "@/garden/tokens";

export interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  style?: CSSProperties;
}

function Skeleton({
  width = "100%",
  height = TOKENS.size[16],
  radius = TOKENS.radius[6],
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${TOKENS.color.surface.subtle} 25%, ${TOKENS.color.brand.surface} 50%, ${TOKENS.color.surface.subtle} 75%)`,
        backgroundSize: "200% 100%",
        animation: TOKENS.motion.animation.shimmer,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export default Skeleton;
