/**
 * Foundation — botao iconografico com variantes visuais.
 *
 * `default`: caixa hover/active estilo inbox/filtros (delegado ao `Highlight` variant
 * `icon`). `plain`: sem caixa, so' troca de cor (toolbars/headers). `floating`:
 * superficie elevada com borda + raio full (uso em overlays).
 *
 * Composicao: `Pressable` (acessibilidade) > `Highlight` (estado visual) > children.
 */

import { forwardRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import Pressable from "@/garden/foundations/interaction/Pressable";
import Highlight from "@/garden/foundations/interaction/Highlight";
import { TOKENS } from "@/garden/tokens";

type IconActionVariant = "default" | "plain" | "floating";
type IconActionTone = "default" | "danger";
type IconActionSize = "xs" | "sm" | "md" | "lg";

const ICON_ACTION_SIZE_MAP: Record<IconActionSize, string> = {
  xs: TOKENS.size[16],
  sm: TOKENS.size[26],
  md: TOKENS.size[28],
  lg: TOKENS.size[32],
};

interface IconActionProps extends HTMLAttributes<HTMLElement> {
  active?: boolean;
  onPress?: () => void;
  size?: IconActionSize;
  variant?: IconActionVariant;
  tone?: IconActionTone;
  /** Aplicado ao `Pressable` (ex.: `cursor` com `aria-disabled` sem `disabled` nativo). */
  pressableStyle?: CSSProperties;
}

const IconAction = forwardRef<HTMLElement, IconActionProps>(
  (
    {
      children,
      active = false,
      onPress,
      size = "sm",
      variant = "default",
      tone = "default",
      style = {},
      pressableStyle,
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false);

    const isPlain = variant === "plain";
    const isFloating = variant === "floating";
    const resolvedSize = ICON_ACTION_SIZE_MAP[size];

    return (
      <Pressable
        ref={ref}
        as="button"
        onPress={onPress}
        style={{
          padding: TOKENS.spacing[0],
          margin: TOKENS.spacing[0],
          border: "none",
          background: "none",
          ...pressableStyle,
        }}
        {...props}
      >
        <Highlight
          variant={isPlain ? (tone === "danger" ? "icon-plain-danger" : "icon-plain") : "icon"}
          hovered={hovered}
          active={active}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: resolvedSize,
            height: resolvedSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            ...(isFloating && {
              background: TOKENS.color.surface.base,
              border: `1px solid ${TOKENS.color.stroke.subtle}`,
              borderRadius: TOKENS.radius.full,
            }),

            ...style,
          }}
        >
          {children}
        </Highlight>
      </Pressable>
    );
  }
);

export default IconAction;
