/**
 * Dispara o download de um `Blob` no browser (link `<a download>` temporário).
 * O nome do ficheiro é sempre definido pelo caller.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
