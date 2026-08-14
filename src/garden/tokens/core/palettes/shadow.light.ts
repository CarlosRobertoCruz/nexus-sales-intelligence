/**
 * Paleta de sombra — tema claro.
 *
 * Original do garden (herdado do NxS). Preservada organizada aqui, mesmo
 * padrão de `color.light.ts` — ver `../shadow.ts` pra trocar o tema ativo.
 */

export const shadow = {
  card: "0 1px 2px rgba(15, 23, 42, 0.06)",
  /**
   * Item de card/lista selecionado: blur contido + leve tinta brand —
   * leitura de “levantou” sem halo espalhado (evita empilhar `lg` + `brandSoft`).
   */
  cardActive: "0 2px 4px rgba(15, 23, 42, 0.07), 0 4px 12px rgba(15, 23, 42, 0.09), 0 2px 8px rgba(109, 74, 255, 0.16)",
  1: "0 1px 1px rgba(0,0,0,0.03)",
  2: "0 2px 6px rgba(0,0,0,0.05)",
  3: "0 8px 22px rgba(0,0,0,0.08)",
  4: "0 12px 30px rgba(0,0,0,0.12)",
  lg: "0 12px 28px rgba(0,0,0,0.10)",
  brand: "0 10px 26px rgba(109,74,255,0.22)",
  brandSoft: "0 8px 24px rgba(109,74,255,0.10)",
  glow: "0 0 24px rgba(109,74,255,0.30)",
  overlay: "0 30px 80px rgba(0,0,0,0.5)",

  focus: "0 0 0 2px rgba(109,74,255,0.22)",
}
