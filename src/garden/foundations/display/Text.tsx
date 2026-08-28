import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Tooltip from "../overlay/Tooltip";

type TextSize =
  | "xs"
  | "sm"
  | "caption"
  | "md"
  | "lg"
  | "xl"
  | "value"
  | "value-lg"
  | "title-lg"
  | "display";
type TextTone = "primary" | "secondary" | "muted" | "subtle" | "inverse" | "brand" | "warning" | "danger";

interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  size?: TextSize;
  weight?: keyof typeof TOKENS.typography.weight;
  tone?: TextTone | null;
  block?: boolean;
  lineHeight?: number | string;
  truncate?: boolean;
  style?: CSSProperties;
}

const SIZE_MAP: Record<TextSize, string> = {
  xs: TOKENS.typography.size[11],
  sm: TOKENS.typography.size[12],
  caption: TOKENS.typography.size[13],
  md: TOKENS.typography.size[14],
  lg: TOKENS.typography.size[16],
  xl: TOKENS.typography.size[19],
  value: TOKENS.typography.size[24],
  "value-lg": TOKENS.typography.size[28],
  "title-lg": TOKENS.typography.size[32],
  display: TOKENS.typography.size[40],
};

const Text = forwardRef<HTMLSpanElement, TextProps>(
  (
    {
      children,
      size = "sm",
      weight = 400,
      tone = "primary",
      block = false,
      lineHeight,
      truncate = false,
      style = {},
      title,
      ...props
    },
    ref
  ) => {
    const resolvedSize = SIZE_MAP[size];
    const tip = typeof title === "string" && title.trim() ? title : undefined;

    const toneMap: Record<TextTone, string> = {
      primary: TOKENS.color.content.primary,
      secondary: TOKENS.color.content.secondary,
      muted: TOKENS.color.content.muted,
      subtle: TOKENS.color.content.subtle,
      inverse: TOKENS.color.content.inverse,
      brand: TOKENS.color.brand.primary,
      warning: TOKENS.color.feedback.warning,
      danger: TOKENS.color.feedback.danger,
    };

    const span = (
      <span
        ref={ref}
        style={{
          display: block || truncate ? "block" : "inline",
          ...(truncate && {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }),

          fontSize: resolvedSize,
          fontFamily: TOKENS.typography.family.sans,
          fontWeight: TOKENS.typography.weight[weight],
          color: tone ? toneMap[tone] : "inherit",

          lineHeight:
            typeof lineHeight === "number"
              ? lineHeight
              : (TOKENS.typography.lineHeight as Record<string, string | undefined>)?.[lineHeight ?? ""],

          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );

    // `title` nativo vira o Tooltip do Garden — nunca o amarelinho do browser.
    if (!tip) return span;

    return (
      <Tooltip
        label={tip}
        wrapperStyle={
          truncate || block
            ? { width: "100%", maxWidth: "100%", display: "block" }
            : undefined
        }
      >
        {span}
      </Tooltip>
    );
  }
);

Text.displayName = "Text";

export default Text;
