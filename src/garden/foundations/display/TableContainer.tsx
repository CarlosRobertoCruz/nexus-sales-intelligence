import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Highlight from "@/garden/foundations/interaction/Highlight";
import { TOKENS } from "@/garden/tokens";

interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  style?: CSSProperties;
  /**
   * Quando `false`, o cartão não ganha elevação nem sombra extra no hover (listagens densas).
   * Default `true` — mesmo comportamento de `KpiCard` / cartões interativos.
   */
  elevateOnHover?: boolean;
}

export function TableContainer({ children, style, elevateOnHover = true, ...props }: TableContainerProps) {
  return (
    <Highlight
      {...props}
      variant="metric"
      hovered={elevateOnHover ? undefined : false}
      style={{
        borderRadius: TOKENS.radius[14],
        overflow: elevateOnHover ? "hidden" : "visible",
        ...style,
      }}
    >
      {children}
    </Highlight>
  );
}
