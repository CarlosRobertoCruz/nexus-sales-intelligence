/**
 * Foundation — receita de glow inset (borda luminosa por dentro).
 * Domain-blind: recebe cor hex (`#RRGGBB`) ou canais `"r,g,b"`.
 */
export type InsetGlowIntensity = "strong" | "soft";

/** Converte `#RRGGBB` em canais `r,g,b` pra usar em `rgba()`. */
export function hexToRgbChannels(hex: string): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return "255,255,255";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "255,255,255";
  return `${r},${g},${b}`;
}

/** Aceita `#RRGGBB` ou string já no formato `r,g,b`. */
export function toRgbChannels(color: string): string {
  const trimmed = color.trim();
  if (trimmed.includes(",")) return trimmed.replace(/\s/g, "");
  return hexToRgbChannels(trimmed);
}

/**
 * `box-shadow` inset em camadas.
 * - `strong` — botões/pills (3 camadas)
 * - `soft` — ícones/actions secundárias (2 camadas)
 */
export function insetGlowShadow(color: string, intensity: InsetGlowIntensity = "strong"): string {
  const rgb = toRgbChannels(color);
  if (intensity === "soft") {
    return `inset 0 0 8px rgba(${rgb},0.5), inset 0 0 16px rgba(${rgb},0.35)`;
  }
  return `inset 0 0 8px rgba(${rgb},0.55), inset 0 0 16px rgba(${rgb},0.4), inset 0 0 26px rgba(${rgb},0.25)`;
}

/** Fundo translúcido casado com a cor do glow (ex.: `rgba(r,g,b,0.1)`). */
export function insetGlowFill(color: string, alpha = 0.1): string {
  return `rgba(${toRgbChannels(color)},${alpha})`;
}
