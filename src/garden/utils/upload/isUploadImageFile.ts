/** Heurística compartilhada — imagem por MIME ou extensão (ex.: screenshot .png sem type no legado). */
export function isUploadImageFile(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const mime = String(mimeType ?? "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  const name = String(fileName ?? "").trim().toLowerCase();
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(name);
}
