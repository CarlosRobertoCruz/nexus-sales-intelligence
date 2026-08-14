/**
 * Barrel publico das foundations do garden.
 *
 * Cada consumer (apps/, core/ui/) deve importar dos primitives sempre por aqui:
 * `import { Pressable, Text } from "@/garden/foundations"`. Isto preserva o
 * encapsulamento do design system e mantem a possibilidade de mover ficheiros
 * internos sem quebrar consumers.
 *
 * Categorias: display, interaction, layout, overlay, feedback, surface, upload.
 */

export { default as Text } from "./display/Text.tsx";
export { EyebrowSectionTitle } from "./display/EyebrowSectionTitle.tsx";
export type { EyebrowSectionTitleProps } from "./display/EyebrowSectionTitle.tsx";
export { default as IconAction } from "./display/IconAction.tsx";
export { default as Icon } from "./display/Icon.tsx";
export { default as Image } from "./display/Image.tsx";
export { Avatar } from "./display/Avatar";
export { IconTile } from "./display/IconTile";
export {
  ICON_TILE_KPI_LEAD_ICON_PX,
  ICON_TILE_KPI_LEAD_SIDE_PX,
  CATEGORY_FOLDER_ICON_TILE_TONES,
} from "./display/iconTileTokens";
export type { IconTileTone, IconTileSize, CategoryFolderIconTone } from "./display/iconTileTokens";
export { SelectablePastelIconTile } from "./display/SelectablePastelIconTile";
export type { SelectablePastelIconTileProps } from "./display/SelectablePastelIconTile";
export { SignalBars } from "./display/SignalBars";
export type { SignalBarsProps } from "./display/SignalBars";
export { DecorativeBars } from "./display/DecorativeBars";
export type { DecorativeBarsProps } from "./display/DecorativeBars";
export { KpiCard } from "./display/KpiCard";
export type { KpiCardProps } from "./display/KpiCard";
export { TimelineRailNode } from "./display/TimelineRailNode";
export type { TimelineRailNodeProps, TimelineRailNodeTone } from "./display/TimelineRailNode";
export { TimelineRailTrack } from "./display/TimelineRailTrack";
export type { TimelineRailLineExtent, TimelineRailTrackProps } from "./display/TimelineRailTrack";
export {
  TIMELINE_RAIL_TRACK_DEFAULT_DOT_PX,
  TIMELINE_RAIL_TRACK_DEFAULT_STROKE_PX,
  TIMELINE_RAIL_TRACK_DEFAULT_WIDTH_PX,
} from "./display/timelineRailTrackDefaults";
export { TableContainer } from "./display/TableContainer";
export { GridTable } from "./display/GridTable";
export type { ColumnSize } from "./display/GridTable";
export { TablePagination, PaginationNavButton } from "./display/TablePagination";
export { getPaginationVisiblePages } from "./display/paginationVisiblePages";

export { default as Pressable } from "./interaction/Pressable.tsx";
export type { PressableProps } from "./interaction/Pressable.tsx";
export { GlowActionButton } from "./interaction/GlowActionButton.tsx";
export type { GlowActionButtonProps, GlowActionButtonTone } from "./interaction/GlowActionButton.tsx";
export {
  hexToRgbChannels,
  insetGlowFill,
  insetGlowShadow,
  toRgbChannels,
} from "./effects/insetGlow";
export type { InsetGlowIntensity } from "./effects/insetGlow";
export { HoverBorderTile } from "./interaction/HoverBorderTile.tsx";
export type { HoverBorderTileProps } from "./interaction/HoverBorderTile.tsx";
export { default as Button } from "./interaction/Button.tsx";
export { default as Checkbox } from "./interaction/Checkbox.tsx";
export { default as Input } from "./interaction/Input.tsx";
export { default as Highlight } from "./interaction/Highlight.tsx";
export { default as Card } from "./interaction/Card.tsx";
export { default as SummaryCard } from "./interaction/SummaryCard.tsx";
export type { SummaryCardProps } from "./interaction/SummaryCard.tsx";
export { ToggleSwitch } from "./interaction/ToggleSwitch";
export { ActionIconButton } from "./interaction/ActionIconButton";
export { TooltipIconAction } from "./interaction/TooltipIconAction";
export type { TooltipIconActionProps } from "./interaction/TooltipIconAction";
export { SearchInput } from "./interaction/SearchInput";
export { Select } from "./interaction/Select";
export type { SelectOption } from "./interaction/Select";
export { DatePicker } from "./interaction/DatePicker";
export type { DatePickerProps } from "./interaction/DatePicker";

export { default as Stack } from "./layout/Stack.tsx";
export { default as Spacer } from "./layout/Spacer.tsx";
export { default as Row } from "./layout/Row.tsx";
export { default as Section } from "./layout/Section.tsx";
export { default as Field } from "./layout/Field.tsx";
export { default as ScrollableList } from "./layout/ScrollableList.tsx";
export { default as ListRow } from "./layout/ListRow.tsx";
export {
  InactiveListRowDim,
  ListRowLeadingPlate,
  ListRowLeadingSymbol,
  LIST_ROW_INACTIVE_DIM_OPACITY,
} from "./layout/InactiveListRow";
export type {
  InactiveListRowDimProps,
  ListRowLeadingAccentTone,
  ListRowLeadingPlateActiveSkin,
  ListRowLeadingPlateProps,
} from "./layout/InactiveListRow";
export { primaryLineToneForActiveListRow } from "./layout/primaryLineToneForActiveListRow";

export { default as Tooltip, FloatingTooltip } from "./overlay/Tooltip.tsx";
export {
  DataTooltipHeading,
  DataTooltipMetricLine,
  DataTooltipMetaSuffix,
} from "./overlay/DataTooltipPrimitives.tsx";
export { default as Overlay } from "./overlay/Overlay.tsx";
export { default as Modal } from "./overlay/Modal.tsx";
export { ModalFooterActions } from "./overlay/ModalFooterActions.tsx";
export type { ModalFooterActionsProps } from "./overlay/ModalFooterActions.tsx";
export { DropdownMenu } from "./overlay/DropdownMenu";
export type { DropdownMenuItem } from "./overlay/DropdownMenu";

export { default as Badge } from "./feedback/Badge";
export type { BadgeVariant } from "./feedback/Badge";
export { default as StatusDot } from "./feedback/StatusDot";
export { StatusPill } from "./feedback/StatusPill";
export type { StatusPillProps, StatusPillTone } from "./feedback/StatusPill";
export { default as ProgressBar } from "./feedback/ProgressBar";
export { default as LoadingOverlay } from "./feedback/LoadingOverlay";
export { default as Skeleton } from "./feedback/Skeleton";
export type { SkeletonProps } from "./feedback/Skeleton";
export { default as LoadingScreen } from "./feedback/LoadingScreen";

export { default as Surface } from "./surface/Surface.tsx";

export { default as FilePreview } from "./upload/FilePreview";
export type { FilePreviewItem } from "./upload/FilePreview";
