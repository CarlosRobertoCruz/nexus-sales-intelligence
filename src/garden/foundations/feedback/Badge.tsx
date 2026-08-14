/**
 * Foundation — pill/dot de feedback semantico.
 *
 * Variants brand/notification/neutral/success/info/warning/danger combinam fundo + texto.
 * `pulse=true` aplica a animacao global `pulse` (definida em `index.css`). `dot=true`
 * acrescenta um pequeno marcador a' esquerda do texto, util para status indicator.
 * `shape="pill"` (padrao) usa radius.full; `shape="tag"` usa radius[6], fundo pastel
 * suave (PastelSoft / equivalentes brand/surface) e padding maior.
 */

import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { TOKENS } from "@/garden/tokens";

export type BadgeVariant =
  | "brand"
  | "notification"
  | "neutral"
  | "success"
  | "info"
  | "warning"
  | "attention"
  | "danger";
type BadgeSize = "xs" | "sm" | "md";
type BadgeShape = "pill" | "tag";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  pulse?: boolean;
  dot?: boolean;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      children,

      variant = "brand",
      size = "md",
      shape = "pill",

      pulse = false,
      dot = false,

      style = {},
      ...props
    },
    ref
  ) => {

    const sizeMap = {
      xs: {
        fontSize: TOKENS.typography.size[9],
        paddingTop: TOKENS.spacing[1],
        paddingBottom: TOKENS.spacing[1],
        paddingLeft: TOKENS.spacing[3],
        paddingRight: TOKENS.spacing[3],
        minWidth: TOKENS.size[14],
        height: TOKENS.size[14],
      },

      sm: {
        fontSize: TOKENS.typography.size[9],
        paddingTop: shape === "tag" ? TOKENS.spacing[4] : TOKENS.spacing[2],
        paddingBottom: shape === "tag" ? TOKENS.spacing[4] : TOKENS.spacing[2],
        paddingLeft: shape === "tag" ? TOKENS.spacing[10] : TOKENS.spacing[6],
        paddingRight: shape === "tag" ? TOKENS.spacing[10] : TOKENS.spacing[6],
      },

      md: {
        fontSize: TOKENS.typography.size[11],
        paddingTop: shape === "tag" ? TOKENS.spacing[6] : TOKENS.spacing[2],
        paddingBottom: shape === "tag" ? TOKENS.spacing[6] : TOKENS.spacing[2],
        paddingLeft: shape === "tag" ? TOKENS.spacing[12] : TOKENS.spacing[8],
        paddingRight: shape === "tag" ? TOKENS.spacing[12] : TOKENS.spacing[8],
      },
    };

    const currentSize = (sizeMap[size] || sizeMap.md) as Partial<typeof sizeMap.xs> & typeof sizeMap.md;

    const variantMap = {
      brand: {
        background: TOKENS.color.brand.soft,
        color: TOKENS.color.brand.primary,
      },

      notification: {
        background: shape === "tag" ? TOKENS.color.brand.surface : TOKENS.color.brand.primary,
        color: shape === "tag" ? TOKENS.color.brand.primary : TOKENS.color.content.inverse,
      },

      neutral: {
        background: shape === "tag" ? TOKENS.color.surface.subtle : TOKENS.color.surface.base,
        color: TOKENS.color.content.subtle,
      },

      success: {
        background: shape === "tag" ? TOKENS.color.feedback.successPastelSoft : TOKENS.color.feedback.successSoft,
        color: TOKENS.color.feedback.success,
      },

      info: {
        background: shape === "tag" ? TOKENS.color.feedback.infoPastelSoft : TOKENS.color.feedback.infoSoft,
        color: TOKENS.color.feedback.info,
      },

      warning: {
        background: shape === "tag" ? TOKENS.color.feedback.warningPastelSoft : TOKENS.color.feedback.warningSoft,
        color: TOKENS.color.feedback.warning,
      },

      attention: {
        background: shape === "tag" ? TOKENS.color.feedback.attentionPastelSoft : TOKENS.color.feedback.attentionSoft,
        color: TOKENS.color.feedback.attention,
      },

      danger: {
        background: shape === "tag" ? TOKENS.color.feedback.dangerPastelSoft : TOKENS.color.feedback.dangerSoft,
        color: TOKENS.color.feedback.danger,
      },
    };

    const currentVariant = variantMap[variant] || variantMap.brand;

    return (
      <div
        ref={ref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: dot ? TOKENS.spacing[6] : 0,

          borderRadius: shape === "tag" ? TOKENS.radius[6] : TOKENS.radius.full,

          fontWeight: TOKENS.typography.weight[600],
          fontSize: currentSize.fontSize,

          paddingTop: currentSize.paddingTop,
          paddingBottom: currentSize.paddingBottom,
          paddingLeft: currentSize.paddingLeft,
          paddingRight: currentSize.paddingRight,

          ...(currentSize.minWidth && {
            minWidth: currentSize.minWidth,
          }),

          ...(currentSize.height && {
            height: currentSize.height,
          }),

          background: currentVariant.background,
          color: currentVariant.color,

          whiteSpace: "nowrap",

          ...(pulse && {
            animation: TOKENS.motion.animation.pulse,
          }),

          ...style,
        }}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            style={{
              width:
                size === "xs"
                  ? TOKENS.size[6]
                  : TOKENS.size[8],
              height:
                size === "xs"
                  ? TOKENS.size[6]
                  : TOKENS.size[8],
              borderRadius: TOKENS.radius.full,
              background: currentVariant.color,
              flexShrink: 0,
            }}
          />
        )}
        {children}
      </div>
    );
  }
);

export default Badge;
