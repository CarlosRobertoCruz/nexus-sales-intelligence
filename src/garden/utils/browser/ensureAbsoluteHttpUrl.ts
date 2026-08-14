/** URLs sem scheme viram caminho relativo no SPA (ex.: localhost:5173/domínio/...). */
export function ensureAbsoluteHttpUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}
