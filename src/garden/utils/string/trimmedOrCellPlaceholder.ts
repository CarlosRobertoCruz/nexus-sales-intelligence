export const TABLE_CELL_EMPTY_PLACEHOLDER = "—";

export function trimmedOrCellPlaceholder(
  value: string | null | undefined,
  placeholder = TABLE_CELL_EMPTY_PLACEHOLDER
): string {
  const t = String(value ?? "").trim();
  return t || placeholder;
}
