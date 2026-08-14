/**
 * Token core — duracoes, easings e animacoes nomeadas.
 *
 * `animation.pulse` referencia o `@keyframes pulse` definido em `index.css` (CSS-only).
 */

export const motion = {
  duration: {
    100: "100ms",
    180: "180ms",
    220: "220ms",
    420: "420ms",
  },

  easing: {
    standard: "ease",
    premium: "cubic-bezier(0.22, 1, 0.36, 1)",
  },

  animation: {
    pulse: "pulse 1.2s ease-in-out infinite",
    shimmer: "shimmer 1.6s linear infinite",
    logoEnter: "logoEnter 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
    loadingBar: "loadingBar 1.4s ease infinite",
  }
}