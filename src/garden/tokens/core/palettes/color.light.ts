/**
 * Paleta de cor — tema claro.
 *
 * Original do garden (herdado do NxS). Não é o tema ativo do NDS hoje (ver
 * `color.dark.ts` e `../color.ts`), mas fica preservado organizado aqui —
 * se o NDS algum dia oferecer tema claro, é só trocar o re-export em
 * `../color.ts`, sem redesenhar paleta do zero.
 */

export const color = {
  /** Equivalente a `transparent` em CSS — evita literal na feature. */
  transparent: "transparent",

  brand: {
    primary: "#6d4aff",
    /** Variante escura do primary — usada como ponto final de gradientes (header, hero). */
    deep: "#4f35cc",
    /**
     * Borda/emphasis brand mais suaves que primary, porém totalmente **opacas**.
     * Os tokens `soft` / `highlight*` usam alpha; em stroke 1px sobre branco podem parecer lavados ou "sujos".
     */
    borderMuted: "#b6a8ed",
    soft: "rgba(109,74,255,0.08)",
    /**
     * Fundo translúcido brand para hover/seleção suave (linha ativa, tile hover).
     * Mais leve que `soft` / `highlight`.
     */
    fillSubtle: "rgba(109,74,255,0.12)",
    surface: "#f3f0ff",
    /** Variante ainda mais clara que `surface` — para containers sutis como caixas de conteúdo. */
    surfaceLight: "#f8f7ff",
    highlight: "rgba(109,74,255,0.10)",
    highlightActive: "rgba(109,74,255,0.22)",
    /**
     * Fundo ativo do item do rail (sidebar): glow radial a partir da borda
     * esquerda — usa `deep` (79,53,204) com alphas decrescentes.
     */
    railItemActive:
      "radial-gradient(circle at 18% 50%, rgba(79,53,204,0.55) 0%, rgba(79,53,204,0.32) 35%, rgba(79,53,204,0.10) 70%, rgba(79,53,204,0) 100%)",
  },

  surface: {
    base: "#ffffff",
    sunken: "#f0f1f7",
    subtle: "#f7f8fc",
    card: "#ffffff",
    elevated: "#ffffff",
    /** Bolha outbound (texto agente) sobre fundo `subtle` — opacidade fixa no DS. */
    bubbleOutbound: "rgba(255,255,255,0.62)",
    overlay: "rgba(24,24,27,0.75)",
    inverse: "#0B0F19",
  },

  content: {
    primary: "#111827",
    secondary: "#374151",
    muted: "#6b7280",
    subtle: "#9ca3af",
    /**
     * Cinza neutro fixo para chrome de ação (GlowActionButton gray, quick actions).
     * Não acompanha `subtle`/`muted` do tema — mesma estabilidade de `inverse`.
     */
    neutral: "#9CA3AF",
    /**
     * Texto/ícone legível sobre fundo saturado/preenchido (botão primário,
     * badge, checkbox marcado) — não é especificamente sobre `surface.inverse`.
     */
    inverse: "#ffffff",
    inverseMuted: "rgba(255,255,255,0.62)",
  },

  stroke: {
    subtle: "#c7cedf",
    default: "#d6d9e6",
    strong: "#c2c7da",
  },

  interactive: {
    hover: "#eef1f7",
    selected: "#eef0ff",
    focus: "rgba(109,74,255,0.18)",
    alert: "rgba(245,158,11,0.15)",

    dark: {
      hover: "rgba(255,255,255,0.06)",
      active: "rgba(109,74,255,0.16)",
      /** Fundos e bordas sobre gradiente brand / superfície escura (ex.: banner do editor). */
      surfaceMuted: "rgba(255,255,255,0.1)",
      surface: "rgba(255,255,255,0.15)",
      surfaceEmphasis: "rgba(255,255,255,0.25)",
      border: "rgba(255,255,255,0.35)",
      borderStrong: "rgba(255,255,255,0.4)",
      scrim: "rgba(0,0,0,0.5)",
    },
  },

  feedback: {
    success: "#10b981",
    successSoft: "rgba(16,185,129,0.12)",
    successPastel: "#7cc9b1",
    successPastelSoft: "rgba(124,201,177,0.18)",
    attention: "#EAB308",
    attentionSoft: "rgba(234,179,8,0.12)",
    attentionPastel: "#EFD26A",
    attentionPastelSoft: "rgba(239,210,106,0.18)",
    warning: "#f59e0b",
    warningSoft: "rgba(245,158,11,0.12)",
    warningPastel: "#e6bd72",
    warningPastelSoft: "rgba(230,189,114,0.18)",
    danger: "#ef4444",
    dangerSoft: "rgba(239,68,68,0.12)",
    dangerPastel: "#dd8f97",
    dangerPastelSoft: "rgba(221,143,151,0.18)",
    info: "#0ea5e9",
    infoSoft: "rgba(14,165,233,0.12)",
    infoPastel: "#77bddf",
    infoPastelSoft: "rgba(119,189,223,0.18)",
  },

  chart: {
    seriesPrimary: "#7C6FE0",
    positive: "#0f8f63",
    warning: "#c47a06",
    negative: "#c92f35",
    neutral: "#9ca3af",
    info: "#0ea5e9",

    pastel: {
      primary: "#D8C7FF",
      positive: "#7cc9b1",
      warning: "#e6bd72",
      negative: "#dd8f97",
      neutral: "#d1d5db",
      info: "#77bddf",
    },
  },

  category: {
    pastelLavender: "#D8C7FF",
    pastelLavenderSoft: "#EBE3FF",
    pastelSky: "#BFE9FF",
    pastelSkySoft: "#DFF4FF",
    pastelMint: "#C8F5D4",
    pastelMintSoft: "#E4FAEA",
    pastelPeach: "#FFE8BF",
    pastelPeachSoft: "#FFF4DF",
    pastelRose: "#FFD1D1",
    pastelRoseSoft: "#FFE8E8",
    pastelViolet: "#E5D4FF",
    pastelVioletSoft: "#F2EAFF",
    pastelAqua: "#C7F3F1",
    pastelAquaSoft: "#E3F9F8",
    pastelLime: "#EAF6C4",
    pastelLimeSoft: "#F5FBE2",
    accentPurple: "#5B3DF5",
    accentBlue: "#2D78F4",
    accentGreen: "#16A34A",
    accentTeal: "#0D9488",
    accentOrange: "#EA580C",
    accentRed: "#DC2626",
    accentPink: "#DB2777",
    accentAmber: "#CA8A04",
    accentViolet: "#7C3AED",
    accentSlate: "#475569",
  },

}
