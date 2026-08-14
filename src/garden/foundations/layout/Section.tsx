/**
 * Foundation — bloco de conteudo com padding tematico (default `12 16`).
 *
 * Usado para enquadrar grupos logicos (notas, atendimentos, paineis) com respiro
 * consistente sem precisar lembrar valores de spacing. Aceita override de
 * `paddingX`/`paddingY` quando o contexto exige.
 */

import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { TOKENS } from "@/garden/tokens";

interface SectionProps extends HTMLAttributes<HTMLDivElement> {
  paddingY?: CSSProperties["paddingTop"];
  paddingX?: CSSProperties["paddingLeft"];
}

const Section = forwardRef<HTMLDivElement, SectionProps>(
  (
    {
      children,
      paddingY = TOKENS.spacing[12],
      paddingX = TOKENS.spacing[16],
      style = {},
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        style={{
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

export default Section;