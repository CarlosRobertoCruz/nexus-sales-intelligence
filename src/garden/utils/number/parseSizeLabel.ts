// garden/utils — interpreta strings de tamanho legíveis ("512 KB", "1.2 MB" etc.) e devolve o valor em MB.
// Escala binária (1024); aceita vírgula como separador decimal; entrada inválida → 0.
// NÃO formata — para isso use formatMbDisplay ou formatBytesDisplay. Não conhece produto nem feature.
/** Converte um label de tamanho formatado (ex.: `"512 KB"`, `"1.2 MB"`, `"2,5 GB"`) para megabytes. */
export function parseSizeLabelToMb(label: string): number {
  const match = label.trim().match(/^([\d.,]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toUpperCase();
  if (unit === "B") return value / (1024 * 1024);
  if (unit === "KB") return value / 1024;
  if (unit === "MB") return value;
  if (unit === "GB") return value * 1024;
  return 0;
}
