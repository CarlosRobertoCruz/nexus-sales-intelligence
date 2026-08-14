/** Tom da primeira linha de titulo; use com `<Text tone={…} />` ao lado do leading. */
export function primaryLineToneForActiveListRow(isActive: boolean): "primary" | "muted" {
  return isActive ? "primary" : "muted";
}
