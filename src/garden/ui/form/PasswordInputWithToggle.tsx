import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import { Stack, Input, Icon, IconAction } from "@/garden/foundations";
import { EyeOpenIcon, EyeSlashIcon } from "@/garden/foundations/assets/icons/icons";

type InputSize = "sm" | "md" | "lg";

export interface PasswordInputWithToggleProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  ariaLabelShow: string;
  ariaLabelHide: string;
  autoComplete: string;
  ariaRequired?: boolean;
  disabled?: boolean;
  size?: InputSize;
  icon?: ReactNode;
}

export function PasswordInputWithToggle({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  ariaLabelShow,
  ariaLabelHide,
  autoComplete,
  ariaRequired,
  disabled,
  size = "md",
  icon,
}: PasswordInputWithToggleProps) {
  return (
    <Stack
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <Input
        size={size}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-required={ariaRequired}
        disabled={disabled}
        icon={icon}
        style={{
          minWidth: 0,
          maxWidth: "100%",
          width: "100%",
          boxSizing: "border-box",
          paddingRight: TOKENS.spacing[40],
        }}
      />
      <Stack
        style={{
          position: "absolute",
          right: TOKENS.spacing[4],
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        <IconAction
          variant="plain"
          size="lg"
          onPress={onToggleShow}
          aria-disabled={disabled}
          aria-label={show ? ariaLabelHide : ariaLabelShow}
        >
          <Icon size="sm" color={TOKENS.color.content.subtle}>
            {show ? <EyeSlashIcon /> : <EyeOpenIcon />}
          </Icon>
        </IconAction>
      </Stack>
    </Stack>
  );
}
