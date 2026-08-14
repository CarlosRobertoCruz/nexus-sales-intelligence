// garden/utils — formata valores em bytes para exibição legível com unidade (B → KB → MB → GB).
// Usa toFixed com dot decimal; não localiza.
// NÃO é formatador de taxa de transferência — para Mbps/Gbps use formatLinkRateValue.
/** Compacta bytes para a maior unidade legível (ex.: 1_500_000 → `"1.50 MB"`). */
export function formatBytesDisplay(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes > 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
