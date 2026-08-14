/**
 * Normaliza URL de upload para exibição no browser.
 * Em dev, VITE_API_URL aponta para :3001 mas a UI roda em :5173 — path relativo passa pelo proxy do Vite.
 * `uploadPathPrefix` deve corresponder ao prefixo de rota do servidor (ex.: "/uploads/").
 */
export function resolveBrowserUploadUrl(
  url: string | null | undefined,
  uploadPathPrefix = "/uploads/",
): string {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(uploadPathPrefix)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith(uploadPathPrefix)) {
      return parsed.pathname;
    }
  } catch {
    /* URL relativa ou inválida */
  }

  return trimmed;
}
