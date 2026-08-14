import { TOKENS } from "@/garden/tokens";

export type IconTileTone =
  | "lavender"
  | "sky"
  | "mint"
  | "peach"
  | "rose"
  | "violet"
  | "aqua"
  | "lime"
  | "neutral";

/** Pastel folder tones selectable for taxonomy-style lists (excludes neutral). */
export type CategoryFolderIconTone = Exclude<IconTileTone, "neutral">;

export const CATEGORY_FOLDER_ICON_TILE_TONES = [
  "lavender",
  "sky",
  "mint",
  "peach",
  "rose",
  "violet",
  "aqua",
  "lime",
] as const satisfies readonly CategoryFolderIconTone[];

export type IconTileSize = "sm" | "md" | "lg";

export const ICON_TILE_SIZE_MAP: Record<IconTileSize, string> = {
  sm: TOKENS.size[32],
  md: TOKENS.size[40],
  lg: TOKENS.size[48],
};

/**
 * Lado do tile pastel usado em lead de KPI / tabela / picker de tom de pasta.
 * Igual a `KpiCard` com `icon` (`iconSize` padrão) e a `IconTile` preset `lg`.
 */
export const ICON_TILE_KPI_LEAD_SIDE_PX = ICON_TILE_SIZE_MAP.lg;

/** Glifo central (~metade do lado do tile KPI). */
export const ICON_TILE_KPI_LEAD_ICON_PX = TOKENS.size[24];
