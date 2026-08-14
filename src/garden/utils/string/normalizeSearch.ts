/** Camada core/utils/string — normaliza valor para chave de busca (string lowercase trim); coerciona qualquer entrada via String(). */
export function normalizeSearch(value: unknown): string {
  if (value === null || value === undefined) return "";

  return String(value).toLowerCase().trim();
}

/**
 * Normaliza para comparação em buscas de listagem (pt-BR): remove marcas diacríticas (NFD),
 * depois lowercase e trim. Preferir este helper em `domain/` em vez de duplicar `normalize("NFD")`.
 */
export function normalizeSearchFold(value: unknown): string {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
