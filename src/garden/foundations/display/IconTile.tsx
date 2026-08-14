import { forwardRef, type ReactNode, type CSSProperties } from "react";
import { TOKENS } from "@/garden/tokens";
import { ICON_TILE_SIZE_MAP, type IconTileSize, type IconTileTone } from "./iconTileTokens";

interface IconTileProps {
  tone?: IconTileTone;
  size?: IconTileSize;
  children?: ReactNode;
  style?: CSSProperties;
}

const SIZE_MAP = ICON_TILE_SIZE_MAP;

const RADIUS_FOR_SIZE: Record<IconTileSize, string> = {
  sm: TOKENS.radius[8],
  md: TOKENS.radius[10],
  lg: TOKENS.radius[12],
};

const TONE_BG: Record<IconTileTone, string> = {
  lavender: TOKENS.color.category.pastelLavenderSoft,
  sky: TOKENS.color.category.pastelSkySoft,
  mint: TOKENS.color.category.pastelMintSoft,
  peach: TOKENS.color.category.pastelPeachSoft,
  rose: TOKENS.color.category.pastelRoseSoft,
  violet: TOKENS.color.category.pastelVioletSoft,
  aqua: TOKENS.color.category.pastelAquaSoft,
  lime: TOKENS.color.category.pastelLimeSoft,
  neutral: TOKENS.color.surface.subtle,
};

const TONE_INK: Record<IconTileTone, string> = {
  lavender: TOKENS.color.brand.primary,
  violet: TOKENS.color.brand.primary,
  sky: TOKENS.color.feedback.info,
  aqua: TOKENS.color.feedback.info,
  mint: TOKENS.color.feedback.success,
  lime: TOKENS.color.feedback.success,
  peach: TOKENS.color.feedback.warning,
  rose: TOKENS.color.feedback.danger,
  neutral: TOKENS.color.content.primary,
};

export const IconTile = forwardRef<HTMLDivElement, IconTileProps>(
  ({ tone = "lavender", size = "md", children, style, ...props }, ref) => {
    const resolvedSize = SIZE_MAP[size];

    return (
      <div
        ref={ref}
        style={{
          width: resolvedSize,
          height: resolvedSize,
          borderRadius: RADIUS_FOR_SIZE[size],
          background: TONE_BG[tone],
          color: TONE_INK[tone],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IconTile.displayName = "IconTile";
