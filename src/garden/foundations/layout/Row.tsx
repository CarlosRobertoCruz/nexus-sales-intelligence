/**
 * Foundation — flexbox horizontal com `gap`, `align`, `justify` e padding X/Y.
 *
 * Equivalente a `<Stack direction="row">` com a vantagem de aceitar padding interno
 * directamente, util quando o Row ja' faz o papel de container (header de linha,
 * cabeçalho de seccao, etc.) sem precisar embrulhar em outro div.
 */

import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: CSSProperties["gap"];
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  paddingX?: CSSProperties["paddingLeft"];
  paddingY?: CSSProperties["paddingTop"];
}

const Row = forwardRef<HTMLDivElement, RowProps>(
  (
    {
      children,

      gap = 0,
      align = "center",
      justify = "flex-start",

      paddingX = 0,
      paddingY = 0,

      style = {},
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        style={{
          display: "flex",
          flexDirection: "row",

          gap: gap,
          alignItems: align,
          justifyContent: justify,

          padding: `${paddingY} ${paddingX}`,

          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export default Row;