import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Icon from "../display/Icon";
import IconAction from "../display/IconAction";
import Tooltip from "../overlay/Tooltip";

/**
 * Ícone clicável + tooltip quando o caso **não** é coberto por `ActionIconButton`
 * (`edit`/`delete`/… fixos).
 *
 * Composição alinhada a `ActionIconButton`: `Tooltip` · `IconAction` plain · `Icon` · `children` (SVG).
 */
export interface TooltipIconActionProps {
  /** Texto do tooltip e fallback de `aria-label`. */
  label: string;
  onPress?: () => void;
  children: ReactNode;
  /**
   * Cor base antes de hover/active (variante plain).
   * - `muted`: tom neutro (`Highlight` icon-plain).
   * - `brand`: `TOKENS.color.brand.primary` (toolbar / destaque discreto).
   */
  idleTone?: "muted" | "brand";
  /** Envelope `Icon`; default `sm` (alinhado a `ActionIconButton`). */
  iconSize?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
}

export function TooltipIconAction({
  label,
  onPress,
  children,
  idleTone = "muted",
  iconSize = "sm",
  disabled = false,
}: TooltipIconActionProps) {
  return (
    <Tooltip label={label}>
      <IconAction
        variant="plain"
        size="md"
        aria-label={label}
        aria-disabled={disabled ? true : undefined}
        onPress={() => {
          if (disabled) return;
          onPress?.();
        }}
        pressableStyle={disabled ? { cursor: "not-allowed" } : undefined}
        style={{
          ...(idleTone === "brand" ? { color: TOKENS.color.brand.primary } : {}),
          ...(disabled ? { opacity: 0.55 } : {}),
        }}
      >
        <Icon size={iconSize} color="currentColor">{children}</Icon>
      </IconAction>
    </Tooltip>
  );
}
