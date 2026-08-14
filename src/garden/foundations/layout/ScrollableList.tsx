/**
 * Foundation — container de lista com scroll vertical condicional.
 *
 * Calcula `maxHeight` como `itemHeight * maxVisible`. Quando `count <= maxVisible`,
 * o `overflow` fica `hidden` (sem scrollbar fantasma); acima disso, ativa scroll com
 * `paddingRight` para evitar que a barra cubra o conteudo.
 */

import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";

interface ScrollableListProps {
  /** Número máximo de itens visíveis antes do scroll. */
  maxVisible?: number;
  /** Altura de cada item como CSS string, ex: TOKENS.size[36]. */
  itemHeight: string;
  /** Total de itens — determina se o scroll deve aparecer. */
  count?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

function ScrollableList({
  maxVisible = 4,
  itemHeight,
  count = 0,
  children,
  style,
}: ScrollableListProps) {
  const isScrollable = count > maxVisible;

  return (
    <div
      style={{
        maxHeight: `calc(${itemHeight} * ${maxVisible})`,
        overflowY: isScrollable ? "auto" : "hidden",
        overflowX: "hidden",
        paddingRight: isScrollable ? TOKENS.spacing[4] : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default ScrollableList;
