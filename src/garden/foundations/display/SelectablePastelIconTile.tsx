
import type { CSSProperties, ReactNode } from "react";
import { TOKENS } from "@/garden/tokens";
import Highlight from "@/garden/foundations/interaction/Highlight.tsx";
import Pressable from "@/garden/foundations/interaction/Pressable.tsx";
import { IconTile } from "./IconTile.tsx";
import type { CategoryFolderIconTone, IconTileSize } from "./iconTileTokens";

export interface SelectablePastelIconTileProps {
  tone: CategoryFolderIconTone;
  selected: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onPress: () => void;
  children: ReactNode;
  iconTileSize?: IconTileSize;
}

export function SelectablePastelIconTile({
  tone,
  selected,
  disabled = false,
  ariaLabel,
  onPress,
  children,
  iconTileSize = "md",
}: SelectablePastelIconTileProps) {
  const shell: CSSProperties = {
    borderRadius: TOKENS.radius[10],
    display: "inline-flex",
    padding: TOKENS.spacing[0],
    lineHeight: 0,
  };

  return (
    <Pressable
      as="button"
      type="button"
      appearance="bare"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onPress={onPress}
    >
      <Highlight variant="card" active={selected} style={shell}>
        <IconTile tone={tone} size={iconTileSize}>
          {children}
        </IconTile>
      </Highlight>
    </Pressable>
  );
}
