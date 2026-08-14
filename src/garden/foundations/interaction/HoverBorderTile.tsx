import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";

export interface HoverBorderTileProps {
  children: ReactNode | ((state: { hovered: boolean }) => ReactNode);
  padding?: string;
  style?: CSSProperties;
}

/** Caixa de stat/chip (ícone + texto) que acende a borda roxa no hover — layout do conteúdo fica por conta de quem chama.
 * `children` pode ser uma função `({ hovered }) => ReactNode` quando o conteúdo interno (ex.: cor do ícone) também precisa reagir ao hover. */
export function HoverBorderTile({
  children,
  padding = `${TOKENS.spacing[10]} ${TOKENS.spacing[12]}`,
  style,
}: HoverBorderTileProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding,
        borderRadius: TOKENS.radius[10],
        border: `1px solid ${hovered ? TOKENS.color.brand.primary : TOKENS.color.stroke.subtle}`,
        background: TOKENS.color.surface.subtle,
        transition: `border-color ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`,
        minWidth: 0,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {typeof children === "function" ? children({ hovered }) : children}
    </div>
  );
}
