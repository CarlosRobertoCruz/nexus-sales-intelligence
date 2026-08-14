/**
 * Foundation — flexbox vertical (default) ou horizontal com `gap`/`align`/`justify`.
 *
 * Mantem-se domain-blind: nao aplica cores, padding ou borders. Apenas organiza
 * children. Para padding interno, use `Section`/`Row` (que adicionam padding) ou
 * `style.padding` no consumer.
 */

import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: CSSProperties["gap"];
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  direction?: "row" | "column";
}

const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      gap = 0,
      align = "stretch",
      justify = "flex-start",
      direction = "column",
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
          flexDirection: direction,

          gap: gap,
          alignItems: align,
          justifyContent: justify,

          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export default Stack;