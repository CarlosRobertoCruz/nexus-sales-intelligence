/**
 * Foundation — botao tematizado com variantes (`primary`, `soft`, `danger`, `icon`),
 * tamanhos (`sm`/`md`/`lg`/`xl`) e radius semantico (`control`/`solid`/`surface`).
 *
 * Variant `icon` forca um quadrado fixo `size[36]` para alinhar com inputs adjacentes;
 * outras variants ficam `auto` largura ou `100%` quando `fullWidth`. Usa `Pressable`
 * por baixo para herdar as semanticas de acessibilidade.
 */

import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Pressable from "./Pressable";
import { TOKENS } from "@/garden/tokens";

type ButtonVariant = "primary" | "soft" | "danger" | "icon";
type ButtonSize = "sm" | "md" | "lg" | "xl";
type ButtonRadius = "control" | "solid" | "surface";

interface ButtonProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
}

const BRAND_PRIMARY_BORDER = `1px solid ${TOKENS.color.brand.primary}`;

const BUTTON_SIZE_MAP: Record<ButtonSize, { paddingY: string; paddingX: string; fontSize: string }> = {
  sm: {
    paddingY: TOKENS.spacing[6],
    paddingX: TOKENS.spacing[18],
    fontSize: TOKENS.typography.size[12],
  },
  md: {
    paddingY: TOKENS.spacing[8],
    paddingX: TOKENS.spacing[16],
    fontSize: TOKENS.typography.size[13],
  },
  lg: {
    paddingY: TOKENS.spacing[10],
    paddingX: TOKENS.spacing[20],
    fontSize: TOKENS.typography.size[14],
  },
  xl: {
    paddingY: TOKENS.spacing[14],
    paddingX: TOKENS.spacing[28],
    fontSize: TOKENS.typography.size[15],
  },
};

const BUTTON_VARIANT_MAP: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: TOKENS.color.brand.primary,
    color: TOKENS.color.content.inverse,
    border: BRAND_PRIMARY_BORDER,
  },
  soft: {
    background: TOKENS.color.brand.soft,
    color: TOKENS.color.brand.primary,
    border: BRAND_PRIMARY_BORDER,
  },
  danger: {
    background: TOKENS.color.feedback.danger,
    color: TOKENS.color.content.inverse,
    border: "none",
  },
  icon: {
    background: TOKENS.color.brand.primary,
    color: TOKENS.color.content.inverse,
    border: "none",
  },
};

const BUTTON_RADIUS_MAP: Record<ButtonRadius, string> = {
  control: TOKENS.radius[8],
  solid: TOKENS.radius[6],
  surface: TOKENS.radius[10],
};

const Button = forwardRef<HTMLElement, ButtonProps>(
  (
    {
      children,
      onPress,
      variant = "primary",
      size = "md",
      radius = "solid",
      fullWidth = false,
      disabled = false,
      type = "button",
      style = {},
      ...props
    },
    ref
  ) => {
    const currentSize = BUTTON_SIZE_MAP[size];
    const isIcon = variant === "icon";
    const currentVariant = BUTTON_VARIANT_MAP[variant];


    const dimension = isIcon ? TOKENS.size[36] : "auto";
    const paddingY = isIcon ? 0 : currentSize.paddingY;
    const paddingX = isIcon ? 0 : currentSize.paddingX;
    const fontSize = isIcon ? TOKENS.size[16] : currentSize.fontSize;
    const borderRadius = BUTTON_RADIUS_MAP[radius];
    const boxShadow = isIcon ? TOKENS.shadow[2] : "none";

    return (
      <Pressable ref={ref} as="button" type={type} appearance="bare" onPress={onPress} disabled={disabled} {...props}>
        <div
          style={{
            width: isIcon ? dimension : fullWidth ? "100%" : "auto",
            height: isIcon ? dimension : "auto",
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius,
            paddingTop: paddingY,
            paddingBottom: paddingY,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            fontSize,
            fontWeight: TOKENS.typography.weight[600],
            ...currentVariant,
            boxShadow,
            opacity: disabled ? 0.45 : 1,
            ...style,
          }}
        >
          {children}
        </div>
      </Pressable>
    );
  }
);

export default Button;
