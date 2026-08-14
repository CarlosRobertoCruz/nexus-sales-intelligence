/**
 * Foundation — checkbox interativo com semântica acessível.
 *
 * Encapsula interação via `Pressable` e estilo via tokens para evitar
 * hardcodes repetidos de tamanho/borda/cor em features.
 */

import type { CSSProperties } from "react";
import Pressable from "./Pressable";
import Text from "../display/Text";
import { TOKENS } from "@/garden/tokens";

interface CheckboxProps {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  label?: string;
  style?: CSSProperties;
}

export default function Checkbox({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  label,
  style,
}: CheckboxProps) {
  return (
    <Pressable
      as="button"
      appearance="bare"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: TOKENS.spacing[8],
        ...style,
      }}
    >
      {({ hovered }) => (
        <>
          <div
            aria-hidden
            style={{
              width: TOKENS.size[16],
              height: TOKENS.size[16],
              borderRadius: TOKENS.radius[6],
              border: `1px solid ${
                checked || hovered ? TOKENS.color.brand.primary : TOKENS.color.stroke.default
              }`,
              background: checked
                ? TOKENS.color.brand.primary
                : hovered
                ? TOKENS.color.brand.soft
                : TOKENS.color.surface.base,
              color: TOKENS.color.content.inverse,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: `all ${TOKENS.motion.duration[180]}`,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {checked ? <Text size="xs" weight={700} tone={null}>✓</Text> : null}
          </div>
          {label ? (
            <Text size="xs" tone="muted">
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
