/**
 * Token core — tipografia (familia + escala de size/lineHeight/weight).
 *
 * Chaves de `lineHeight` usam strings numericas (`1`, `1.2`) para preservar o valor
 * unitless ao serem indexadas; consumer normalmente faz `TOKENS.typography.lineHeight[1.4]`.
 */

export const typography = {

  family: {
    sans: "Inter, system-ui, sans-serif",
  },

  size: {
    9: "9px",
    11: "11px",
    12: "12px",
    13: "13px",
    14: "14px",
    15: "15px",
    16: "16px",
    17: "17px",
    19: "19px",
    20: "20px",
    24: "24px",
    26: "26px",
    28: "28px",
    32: "32px",
    36: "36px",
    40: "40px",
    46: "46px",
  },

  lineHeight: {
    1: "1",
    1.2: "1.2",
    1.25: "1.25",
    1.3: "1.3",
    1.4: "1.4",
    1.55: "1.55",
    1.6: "1.6",
  },

  weight: {
    100: 100,
    200: 200,
    300: 300,
    400: 400,
    500: 500,
    600: 600,
    700: 700,
    800: 800,
  },

  /** Letter-spacing em px; `eyebrow` = pequeno caps / label secundaria em uppercase. */
  letterSpacing: {
    eyebrow: "0.7px",
    tightCaption: "-0.01em",
  },
}