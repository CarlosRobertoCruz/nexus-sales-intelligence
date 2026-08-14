import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface IconProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  size?: IconSize;
  color?: string;
  style?: CSSProperties;
}

const SIZE_MAP: Record<IconSize, string> = {
  xs: TOKENS.size[12],
  sm: TOKENS.size[14],
  md: TOKENS.size[16],
  lg: TOKENS.size[20],
  xl: TOKENS.size[24],
};

const Icon = forwardRef<HTMLDivElement, IconProps>(
  (
    {
      children,
      size = "md",
      color,
      style = {},
      ...props
    },
    ref
  ) => {
    const resolvedSize = SIZE_MAP[size];

    return (
      <div
        ref={ref}
        style={{
          width: resolvedSize,
          height: resolvedSize,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          color,

          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export default Icon;
