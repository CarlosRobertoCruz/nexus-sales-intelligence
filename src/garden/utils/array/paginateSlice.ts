/**
 * Devolve a fatia de `rows` correspondente à página (índice 1-based) e ao tamanho de página.
 * Normaliza `page` e `pageSize` para valores seguros (mínimo 1).
 */
export function paginateSlice<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const safeSize = Math.max(1, pageSize);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safeSize;
  return rows.slice(start, start + safeSize);
}
