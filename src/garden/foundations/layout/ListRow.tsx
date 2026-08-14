/**
 * Foundation — linha de lista com hover-state opcional e separador inferior.
 *
 * Renderiza `borderBottom` salvo quando `isLast=true`. Aplica `marginInline` negativo
 * para que o hover preencha toda a largura do container pai (compensa o `paddingInline`
 * da propria row). Children pode ser render-prop `({ hovered }) => ReactNode`.
 */

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";

type ListRowChildren =
  | ReactNode
  | ((state: { hovered: boolean }) => ReactNode);

interface ListRowProps {
  isLast?: boolean;
  minHeight?: string;
  paddingBlock?: string;
  children?: ListRowChildren;
  style?: CSSProperties;
}

function ListRow({
  isLast = false,
  minHeight,
  paddingBlock,
  children,
  style,
}: ListRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight,
        display: "flex",
        alignItems: "center",
        borderRadius: TOKENS.radius[10],
        borderBottom: isLast
          ? "none"
          : `1px solid ${TOKENS.color.stroke.subtle}`,
        paddingInline: TOKENS.spacing[6],
        marginInline: `-${TOKENS.spacing[6]}`,
        paddingBlock: paddingBlock ?? 0,
        transition: `all ${TOKENS.motion.duration[180]}`,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {typeof children === "function" ? children({ hovered }) : children}
    </div>
  );
}

export default ListRow;
