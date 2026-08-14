import { TOKENS } from "@/garden/tokens";
import { colorWithAlpha } from "@/garden/utils/color/colorWithAlpha";
import Pressable from "./Pressable";
import Tooltip from "../overlay/Tooltip";

const TRACK_W = 36;
const TRACK_H = 20;
const THUMB_SIZE = 14;
const THUMB_OFFSET = 3;
const THUMB_ON_LEFT = TRACK_W - THUMB_SIZE - THUMB_OFFSET;

/** brand.primary em ~34% de opacidade para trilho ligado no estado desabilitado. */
const TRACK_DISABLED_ON = colorWithAlpha(TOKENS.color.brand.primary, "57");

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  "aria-label": string;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, "aria-label": ariaLabel, disabled }: ToggleSwitchProps) {
  const isDisabled = Boolean(disabled);

  const trackBg = isDisabled
    ? checked
      ? TRACK_DISABLED_ON
      : TOKENS.color.stroke.subtle
    : checked
      ? TOKENS.color.brand.primary
      : TOKENS.color.stroke.strong;

  const thumbRing = isDisabled ? `inset 0 0 0 1px ${TOKENS.color.stroke.default}` : undefined;

  return (
    <Tooltip label={ariaLabel}>
      <Pressable
        as="button"
        type="button"
        aria-pressed={checked}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onPress={onChange}
        style={{
          appearance: "none",
          border: "none",
          padding: 0,
          background: "transparent",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.68 : 1,
          transition: `opacity ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
        }}
      >
        <span
          style={{
            display: "block",
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: TOKENS.radius.full,
            background: trackBg,
            position: "relative",
            transition: `background ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: THUMB_OFFSET,
              left: checked ? THUMB_ON_LEFT : THUMB_OFFSET,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: TOKENS.radius.full,
              background: TOKENS.color.surface.base,
              boxShadow: thumbRing,
              transition: `left ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}, box-shadow ${TOKENS.motion.duration[100]} ${TOKENS.motion.easing.standard}`,
            }}
          />
        </span>
      </Pressable>
    </Tooltip>
  );
}
