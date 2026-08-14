// garden/utils — formata valores em megabytes para exibição legível com unidade (B → KB → MB → GB).
// Escala binária (1024); usa toFixed; não localiza.
// NÃO recebe bytes brutos — para isso use formatBytesDisplay. Entrada deve estar em MB.
/** Converte MB para a maior unidade legível (ex.: 0.5 → `"512.0 KB"`, 1.5 → `"1.5 MB"`, 1100 → `"1.07 GB"`). */
export function formatMbDisplay(mb: number): string {
  if (mb < 1 / 1024) return `${Math.round(mb * 1024 * 1024)} B`;
  if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
