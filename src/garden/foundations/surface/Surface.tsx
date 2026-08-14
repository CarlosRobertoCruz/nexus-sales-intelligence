/**
 * Foundation — container visual com `tone`, `padding`, `radius` e `shadow` tematicos.
 *
 * Decoupled de layout: nao define flex/grid. Use Stack/Row dentro como children
 * quando precisar de organizacao interna. `shadow=0` desativa box-shadow.
 */

import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { TOKENS } from "@/garden/tokens";

type SurfaceTone = "base" | "subtle" | "inverse";
type SurfaceShadow = 0 | 1 | 2 | 3;

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone;
  padding?: CSSProperties["padding"];
  radius?: CSSProperties["borderRadius"];
  shadow?: SurfaceShadow;
}

const SURFACE_TONE_MAP: Record<SurfaceTone, string> = {
  base: TOKENS.color.surface.base,
  subtle: TOKENS.color.surface.subtle,
  inverse: TOKENS.color.surface.inverse,
};

const SURFACE_SHADOW_MAP: Record<SurfaceShadow, string> = {
  0: "none",
  1: TOKENS.shadow[1],
  2: TOKENS.shadow[2],
  3: TOKENS.shadow[3],
};

const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      children,

      tone = "base",
      padding = TOKENS.spacing[16],
      radius = TOKENS.radius[12],
      shadow = 0,

      style = {},
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        style={{
          background: SURFACE_TONE_MAP[tone],
          borderRadius: radius,
          boxShadow: SURFACE_SHADOW_MAP[shadow],

          padding: padding,

          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export default Surface;