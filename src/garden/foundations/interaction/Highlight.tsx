/**
 * Foundation — wrapper de estilo para estados visuais (hover, active, focused).
 *
 * Centraliza, por `variant`, a tabela de cores, bordas, raios e shadows que cada
 * primitiva interativa precisa expor (Button via Pressable, Input, Card, IconAction,
 * itens de rail/menu/tab). Mantem a prioridade `active > focus > hover` consistente
 * em toda a UI e evita que cada componente reimplemente a sua propria matriz.
 *
 * Os estados podem ser controlados (props `hovered`/`focused`) ou geridos
 * internamente. Tab usa `borderBottomOverride` em vez de `border` para nao competir
 * com bordas verticais existentes.
 */

import { useState } from "react";
import { TOKENS } from "@/garden/tokens";
import type { HTMLAttributes } from "react";

type HighlightVariant =
  | "icon"
  | "icon-plain"
  | "icon-plain-danger"
  | "card"
  | "surface"
  | "metric"
  | "smart"
  | "menu"
  | "menu-inverse"
  | "row"
  | "rail-item"
  | "input"
  | "input-chat"
  | "field"
  | "tab"
  | "text"
  | "text-muted";

interface HighlightProps extends HTMLAttributes<HTMLDivElement> {
  variant?: HighlightVariant;
  hovered?: boolean;
  active?: boolean;
  focused?: boolean;
}

function Highlight({
  children,
  variant = "card",
  hovered: hoveredProp,
  active = false,
  focused: focusedProp,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  style = {},
  ...props
}: HighlightProps) {
  const [hoveredState, setHoveredState] = useState(false);
  const [focusedState, setFocusedState] = useState(false);
  /** `false` deve significar hover desligado; só cai para estado interno quando a prop omitida (`undefined`). */
  const hovered = hoveredProp === undefined ? hoveredState : hoveredProp;
  const focused = focusedProp === undefined ? focusedState : focusedProp;

  let background = "transparent";
  let border = "none";
  let borderBottomOverride: string | null = null;
  let color = "inherit";
  let borderRadius: string | number = 0;
  let boxShadow = "none";
  let transform = "none";
  let transition = "none";

  if (variant === "icon") {
    background = "transparent";
    border = "none";
    color = TOKENS.color.content.muted;
    borderRadius = TOKENS.radius[8];

    if (active) {
      background = TOKENS.color.brand.primary;
      border = `1px solid ${TOKENS.color.brand.primary}`;
      color = TOKENS.color.content.inverse;
    } else if (hovered) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.primary}`;
      color = TOKENS.color.brand.primary;
    }
  }

  if (variant === "icon-plain") {
    background = "transparent";
    border = "none";
    color = TOKENS.color.content.muted;
    borderRadius = TOKENS.radius[8];

    if (active) {
      color = TOKENS.color.content.primary;
    } else if (hovered) {
      color = TOKENS.color.brand.primary;
    }
  }

  if (variant === "icon-plain-danger") {
    background = "transparent";
    border = "none";
    color = TOKENS.color.content.muted;
    borderRadius = TOKENS.radius[8];

    if (active || hovered) {
      color = TOKENS.color.feedback.danger;
    }
  }

  if (variant === "card") {
    background = TOKENS.color.surface.base;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[8];

    if (active) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
    } else if (hovered) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
    }
  }

  if (variant === "surface") {
    background = TOKENS.color.surface.sunken;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[12];
    transition = `all ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`;

    if (active) {
      border = `1px solid ${TOKENS.color.brand.primary}`;
      boxShadow = `${TOKENS.shadow[2]}, ${TOKENS.shadow.brandSoft}`;
    } else if (hovered) {
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
      boxShadow = `${TOKENS.shadow[2]}, ${TOKENS.shadow.brandSoft}`;
      transform = "translateY(-2px)";
    }
  }

  if (variant === "metric") {
    background = TOKENS.color.surface.base;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[12];
    boxShadow = TOKENS.shadow.card;
    transition = `all ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`;

    if (hovered) {
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
      boxShadow = `${TOKENS.shadow[2]}, ${TOKENS.shadow.brandSoft}`;
      transform = "translateY(-2px)";
    }
  }

  if (variant === "smart") {
    background = TOKENS.color.brand.soft;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[12];
    boxShadow = "none";

    if (active) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
      boxShadow = `${TOKENS.shadow.lg}, ${TOKENS.shadow.brand}, ${TOKENS.shadow.focus}`;
      transform = "translateY(-1px)";
    } else if (hovered) {
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
      boxShadow = `${TOKENS.shadow.lg}, ${TOKENS.shadow.brand}, ${TOKENS.shadow.focus}`;
      transform = "translateY(-1px)";
    }
  }

  if (variant === "menu") {
    background = TOKENS.color.surface.base;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[12];

    if (active || hovered) {
      background = `
        linear-gradient(${TOKENS.color.brand.soft}, ${TOKENS.color.brand.soft}),
        ${TOKENS.color.surface.base}
      `;
      border = `1px solid ${TOKENS.color.brand.borderMuted}`;
    }
  }

  if (variant === "menu-inverse") {
    background = "transparent";
    border = "none";
    borderRadius = TOKENS.radius[6];
    transition = `all ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`;

    if (active || hovered) {
      background = TOKENS.color.interactive.dark.hover;
    }
  }

  if (variant === "row") {
    background = hovered ? TOKENS.color.interactive.selected : "transparent";
    border = "none";
    borderRadius = 0;
    transition = `background ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`;
  }

  if (variant === "rail-item") {
    background = "transparent";
    border = "none";
    borderRadius = TOKENS.radius[0];
    color = TOKENS.color.content.subtle;
    transition = `all ${TOKENS.motion.duration[180]} ${TOKENS.motion.easing.premium}`;

    if (active) {
      background = TOKENS.color.brand.primary;
      color = TOKENS.color.content.inverse;
    } else if (hovered) {
      background = TOKENS.color.interactive.dark.hover;
      color = TOKENS.color.content.inverse;
    }
  }

  if (variant === "input") {
    background = TOKENS.color.surface.base;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[6];

    if (hovered) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.primary}`;
    }

    if (focused) {
      background = TOKENS.color.surface.base;
      border = `1px solid ${TOKENS.color.brand.primary}`;
      color = TOKENS.color.brand.primary;
    }
  }

  if (variant === "input-chat") {
    background = "transparent";
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[10];

    if (hovered) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.primary}`;
    }

    if (focused) {
      background = TOKENS.color.surface.base;
      border = `1px solid ${TOKENS.color.brand.primary}`;
      boxShadow = `0 0 0 2px ${TOKENS.color.brand.soft}`;
    }
  }

  if (variant === "field") {
    background = TOKENS.color.surface.base;
    border = `1px solid ${TOKENS.color.stroke.subtle}`;
    borderRadius = TOKENS.radius[10];
    transition = `all ${TOKENS.motion.duration[180]}`;

    if (hovered) {
      background = TOKENS.color.brand.soft;
      border = `1px solid ${TOKENS.color.brand.primary}`;
    }

    if (focused) {
      background = TOKENS.color.surface.base;
      border = `1px solid ${TOKENS.color.brand.primary}`;
      boxShadow = `0 0 0 2px ${TOKENS.color.brand.soft}`;
    }
  }

  if (variant === "text") {
    color = TOKENS.color.content.primary;
    transition = `color ${TOKENS.motion.duration[180]}`;

    if (hovered) {
      color = TOKENS.color.brand.primary;
    }
  }

  if (variant === "text-muted") {
    color = TOKENS.color.content.muted;
    transition = `color ${TOKENS.motion.duration[180]}`;

    if (hovered) {
      color = TOKENS.color.brand.primary;
    }
  }

  if (variant === "tab") {
    color = TOKENS.color.content.secondary;
    background = "transparent";
    border = "none";
    borderRadius = 0;
    transition = `all ${TOKENS.motion.duration[180]}`;

    if (active) {
      color = TOKENS.color.brand.primary;
      borderBottomOverride = `2px solid ${TOKENS.color.brand.primary}`;
    }
  }

  return (
    <div
      onMouseEnter={(e) => { setHoveredState(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHoveredState(false); onMouseLeave?.(e); }}
      onFocus={(e) => { setFocusedState(true); onFocus?.(e); }}
      onBlur={(e) => { setFocusedState(false); onBlur?.(e); }}
      style={{
        background,
        borderTop: border,
        borderRight: border,
        borderLeft: border,
        borderBottom: borderBottomOverride ?? border,
        color,
        borderRadius,
        boxShadow,
        transform,
        transition,

        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export default Highlight;
