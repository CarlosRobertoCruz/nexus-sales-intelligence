/**
 * Páginas visíveis no estilo 1 … 469 (elipses quando necessário).
 * `totalPages < 1` devolve lista vazia (sem botões numéricos).
 */
export function getPaginationVisiblePages(
  current: number,
  totalPages: number
): (number | "ellipsis")[] {
  if (totalPages < 1) return [];
  if (totalPages === 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const t = totalPages;
  const c = Math.max(1, Math.min(current, t));

  if (c <= 3) {
    return [1, 2, 3, "ellipsis", t];
  }
  if (c >= t - 2) {
    return [1, "ellipsis", t - 2, t - 1, t];
  }
  return [1, "ellipsis", c - 1, c, c + 1, "ellipsis", t];
}
