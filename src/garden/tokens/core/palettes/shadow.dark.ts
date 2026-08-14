/**
 * Paleta de sombra — tema escuro (tema ativo do NDS).
 *
 * Sombras neutras mais fortes que no tema claro (pra continuar lendo como
 * profundidade sobre fundo já escuro) + `glow` roxo pra elementos ativos/em
 * destaque, que é o efeito visível nas telas de referência em `NDS/site/`.
 */

export const shadow = {
  card: "0 1px 2px rgba(0, 0, 0, 0.4)",
  /**
   * Item de card/lista selecionado: blur contido + tinta brand mais forte que em
   * tema claro — leitura de "levantou" com glow, sem halo espalhado demais.
   */
  cardActive: "0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.35), 0 2px 10px rgba(124, 92, 255, 0.28)",
  1: "0 1px 1px rgba(0,0,0,0.25)",
  2: "0 2px 6px rgba(0,0,0,0.35)",
  3: "0 8px 22px rgba(0,0,0,0.45)",
  4: "0 12px 30px rgba(0,0,0,0.55)",
  lg: "0 12px 28px rgba(0,0,0,0.5)",
  brand: "0 10px 30px rgba(124,92,255,0.35)",
  brandSoft: "0 8px 24px rgba(124,92,255,0.18)",
  /** Glow roxo ao redor de elemento ativo/em destaque (botão primário, ícone selecionado). */
  glow: "0 0 24px rgba(124,92,255,0.45)",
  overlay: "0 30px 80px rgba(0,0,0,0.7)",

  focus: "0 0 0 2px rgba(124,92,255,0.32)",
}
