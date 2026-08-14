/** Token core — filtros visuais (blur, glow) e opacidades. Aplicar em `backdropFilter` ou `filter`. */

export const effects = {
  blur: {
    4: "blur(4px)",
    8: "blur(8px)",
    12: "blur(12px)",
  },
  opacity: {
    32: 0.32,
    78: 0.78,
  },
  filter: {
    /** Glow branco curto — ícone ativo sobre fundo brand (rail/sidebar). */
    iconGlowInverse: "drop-shadow(0 0 6px rgba(255,255,255,0.85))",
  },
};
