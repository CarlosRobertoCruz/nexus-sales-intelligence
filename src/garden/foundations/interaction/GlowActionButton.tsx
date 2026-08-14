import type { CSSProperties, ReactNode } from "react";

import { TOKENS } from "@/garden/tokens";
import Icon from "../display/Icon.tsx";
import Row from "../layout/Row.tsx";
import Text from "../display/Text.tsx";
import Pressable from "./Pressable.tsx";
import { insetGlowFill, insetGlowShadow } from "../effects/insetGlow";

export type GlowActionButtonTone = "brand" | "danger" | "lavender" | "gray";

/** Cor de cada tom. "lavender" é variante clara do brand; "gray" neutro. */
const GLOW_TONE: Record<GlowActionButtonTone, string> = {
  brand: TOKENS.color.brand.primary,
  danger: TOKENS.color.feedback.danger,
  lavender: "#B9A9FF",
  gray: TOKENS.color.content.neutral,
};

export interface GlowActionButtonProps {
  icon?: ReactNode;
  label: string;
  /** Só ícone visível; `label` vira aria-label / tooltip externo. */
  iconOnly?: boolean;
  tone?: GlowActionButtonTone;
  onPress?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function GlowActionButton({
  icon,
  label,
  iconOnly = false,
  tone = "brand",
  onPress,
  disabled,
  style,
}: GlowActionButtonProps) {
  const color = GLOW_TONE[tone];

  return (
    <Pressable
      as="button"
      appearance="bare"
      onPress={onPress}
      disabled={disabled}
      aria-label={label}
      style={{
        padding: iconOnly
          ? TOKENS.spacing[8]
          : `${TOKENS.spacing[12]} ${TOKENS.spacing[12]}`,
        borderRadius: TOKENS.radius[10],
        border: `1.5px solid ${color}`,
        background: insetGlowFill(color),
        boxShadow: disabled ? "none" : insetGlowShadow(color, "strong"),
        width: iconOnly ? "auto" : "100%",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <Row align="center" justify="center" gap={TOKENS.spacing[8]}>
        {icon && (
          <Icon size="sm" color={color}>
            {icon}
          </Icon>
        )}
        {!iconOnly ? (
          <Text size="sm" weight={700} style={{ color }}>
            {label}
          </Text>
        ) : null}
      </Row>
    </Pressable>
  );
}
