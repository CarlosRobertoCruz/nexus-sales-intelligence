/** Sufixos alpha em hex de 8 dígitos (`#RRGGBB` + `AA`). */
export const HEX_ALPHA = {
  /** ~9% — fundo suave em pickers e cards */
  subtle: "18",
  /** ~13% — preview de ícone */
  preview: "22",
} as const;

const HEX_RGB_PATTERN = /^#[0-9a-fA-F]{6}$/;
const HEX_ALPHA_PATTERN = /^[0-9a-fA-F]{2}$/;

/** Appends a hex alpha suffix to a 6-digit `#RRGGBB` color. */
export function colorWithAlpha(hex: string, alphaHex: string): string {
  if (!HEX_RGB_PATTERN.test(hex)) return hex;
  if (!HEX_ALPHA_PATTERN.test(alphaHex)) return hex;
  return `${hex}${alphaHex}`;
}
