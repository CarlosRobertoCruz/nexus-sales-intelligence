import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Text from "./Text.tsx";

export type EyebrowSectionTitleProps = {
  children: ReactNode;
  id?: string;
  style?: CSSProperties;
};

export const EyebrowSectionTitle = forwardRef<HTMLSpanElement, EyebrowSectionTitleProps>(
  function EyebrowSectionTitle({ children, id, style }, ref) {
    return (
      <Text
        ref={ref}
        id={id}
        size="sm"
        weight={700}
        tone={null}
        block
        style={{
          textTransform: "uppercase",
          letterSpacing: TOKENS.typography.letterSpacing.eyebrow,
          color: TOKENS.color.content.primary,
          ...style,
        }}
      >
        {children}
      </Text>
    );
  }
);
