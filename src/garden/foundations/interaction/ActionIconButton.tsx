import type { ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import IconAction from "../display/IconAction";
import Icon from "../display/Icon";
import Tooltip from "../overlay/Tooltip";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  EyeOpenIcon,
  EyeSlashIcon,
  Layers2Icon,
  SquarePenIcon,
  Trash2Icon,
} from "@/garden/foundations/assets/icons/icons";

type ActionKind = "edit" | "copy" | "duplicate" | "delete" | "expand" | "collapse" | "open" | "publish" | "unpublish";

const ACTION_CONFIG: Record<ActionKind, { icon: ReactNode; defaultLabel: string; danger: boolean }> = {
  edit:      { icon: <SquarePenIcon />, defaultLabel: "Editar",      danger: false },
  copy:      { icon: <CopyIcon />,      defaultLabel: "Colar",       danger: false },
  duplicate: { icon: <Layers2Icon />,   defaultLabel: "Duplicar",    danger: false },
  delete:    { icon: <Trash2Icon />,    defaultLabel: "Excluir",     danger: true  },
  expand:    { icon: <ChevronDownIcon />, defaultLabel: "Expandir",  danger: false },
  collapse:  { icon: <ChevronUpIcon />,  defaultLabel: "Recolher",   danger: false },
  open:      { icon: <ChevronRightIcon />, defaultLabel: "Abrir",     danger: false },
  publish:   { icon: <EyeOpenIcon />,   defaultLabel: "Publicar",    danger: false },
  unpublish: { icon: <EyeSlashIcon />,  defaultLabel: "Despublicar", danger: false },
};

interface ActionIconButtonProps {
  action: ActionKind;
  onPress: () => void;
  "aria-label"?: string;
  disabled?: boolean;
}

export function ActionIconButton({ action, onPress, "aria-label": ariaLabel, disabled }: ActionIconButtonProps) {
  const { icon, defaultLabel, danger } = ACTION_CONFIG[action];
  const label = ariaLabel ?? defaultLabel;
  return (
    <Tooltip label={label}>
      <IconAction
        variant="plain"
        tone={danger ? "danger" : "default"}
        size="md"
        aria-label={label}
        aria-disabled={disabled ? true : undefined}
        onPress={() => {
          if (disabled) return;
          onPress();
        }}
        pressableStyle={disabled ? { cursor: "not-allowed" } : undefined}
        style={disabled ? { opacity: 0.55 } : undefined}
      >
        <Icon size="sm" color="currentColor">
          {icon}
        </Icon>
      </IconAction>
    </Tooltip>
  );
}
