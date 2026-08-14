/**
 * Paleta de cor — tema escuro (tema ativo do NDS).
 *
 * Cores extraídas das telas de referência em `NDS/site/` (fundo quase preto com
 * tinta roxa, cards levemente mais claros que o fundo, glow roxo em elementos
 * ativos). Mesma estrutura de chaves da paleta clara (`color.light.ts`) —
 * nenhum componente muda, só o valor por trás de cada token.
 */

export const color = {
  /** Equivalente a `transparent` em CSS — evita literal na feature. */
  transparent: "transparent",

  brand: {
    primary: "#7C5CFF",
    /** Variante mais profunda do primary — ponto final de gradientes (header, hero, botão). */
    deep: "#5B3DF5",
    /**
     * Borda/emphasis brand mais suave que primary, porém totalmente **opaca**.
     * Os tokens `soft` / `highlight*` usam alpha; em stroke 1px sobre fundo escuro
     * podem ficar fracos demais para ler como borda de destaque.
     */
    borderMuted: "#4A3A8C",
    soft: "rgba(124,92,255,0.16)",
    /**
     * Fundo translúcido brand para hover/seleção suave (linha ativa, tile hover).
     * Mais leve que `soft` / `highlight`.
     */
    fillSubtle: "rgba(124,92,255,0.12)",
    surface: "#1A1530",
    /** Variante ainda mais clara que `surface` — para containers sutis como caixas de conteúdo. */
    surfaceLight: "#211B3D",
    highlight: "rgba(124,92,255,0.14)",
    highlightActive: "rgba(124,92,255,0.28)",
    /**
     * Fundo ativo do item do rail (sidebar): glow radial a partir da borda
     * esquerda — usa `deep` (91,61,245) com alphas decrescentes.
     */
    railItemActive:
      "radial-gradient(circle at 18% 50%, rgba(91,61,245,0.6) 0%, rgba(91,61,245,0.38) 35%, rgba(91,61,245,0.10) 70%, rgba(91,61,245,0) 100%)",
  },

  surface: {
    base: "#0D0B18",
    /** Mais escuro que `base` — cards "surface" (ONU) que precisam se destacar do fundo do shell. */
    sunken: "#090B19",
    subtle: "#13111F",
    card: "#171426",
    elevated: "#1D1930",
    /** Bolha outbound (texto agente) sobre fundo `subtle` — opacidade fixa no DS. */
    bubbleOutbound: "rgba(255,255,255,0.06)",
    overlay: "rgba(0,0,0,0.7)",
    inverse: "#F5F4FA",
  },

  content: {
    primary: "#F5F4FA",
    secondary: "#B9B6C9",
    muted: "#8B87A0",
    subtle: "#6A6680",
    /**
     * Cinza neutro fixo para chrome de ação (GlowActionButton gray, quick actions).
     * Não acompanha `subtle`/`muted` do tema — mesma estabilidade de `inverse`.
     */
    neutral: "#9CA3AF",
    /**
     * NÃO é "texto sobre surface.inverse" — é o texto/ícone legível sobre
     * fundo saturado/preenchido (botão primário, badge, checkbox marcado,
     * pílula ativa do menu). Em qualquer tema esse fundo é escuro/saturado,
     * então o valor certo é sempre claro — não inverte com o tema.
     */
    inverse: "#FFFFFF",
    inverseMuted: "rgba(255,255,255,0.62)",
  },

  stroke: {
    subtle: "#221E33",
    default: "#2B2640",
    strong: "#3A3454",
  },

  interactive: {
    hover: "rgba(255,255,255,0.04)",
    selected: "rgba(124,92,255,0.16)",
    focus: "rgba(124,92,255,0.28)",
    alert: "rgba(245,158,11,0.18)",

    dark: {
      hover: "rgba(255,255,255,0.06)",
      active: "rgba(124,92,255,0.20)",
      /** Fundos e bordas sobre gradiente brand / superfície ainda mais escura (ex.: banner do editor). */
      surfaceMuted: "rgba(255,255,255,0.1)",
      surface: "rgba(255,255,255,0.15)",
      surfaceEmphasis: "rgba(255,255,255,0.25)",
      border: "rgba(255,255,255,0.35)",
      borderStrong: "rgba(255,255,255,0.4)",
      scrim: "rgba(0,0,0,0.6)",
    },
  },

  feedback: {
    success: "#22C55E",
    successSoft: "rgba(34,197,94,0.16)",
    successPastel: "#4ADE80",
    successPastelSoft: "rgba(74,222,128,0.14)",
    attention: "#FACC15",
    attentionSoft: "rgba(250,204,21,0.16)",
    attentionPastel: "#FDE047",
    attentionPastelSoft: "rgba(253,224,71,0.14)",
    warning: "#F5A623",
    warningSoft: "rgba(245,166,35,0.16)",
    warningPastel: "#FBBF24",
    warningPastelSoft: "rgba(251,191,36,0.14)",
    danger: "#F5555D",
    dangerSoft: "rgba(245,85,93,0.16)",
    dangerPastel: "#FB7185",
    dangerPastelSoft: "rgba(251,113,133,0.14)",
    info: "#38BDF8",
    infoSoft: "rgba(56,189,248,0.16)",
    infoPastel: "#7DD3FC",
    infoPastelSoft: "rgba(125,211,252,0.14)",
  },

  chart: {
    seriesPrimary: "#9C8FFF",
    positive: "#34D399",
    warning: "#FBBF24",
    negative: "#F87171",
    neutral: "#8B87A0",
    info: "#38BDF8",

    pastel: {
      primary: "#3A3363",
      positive: "#1F4B3A",
      warning: "#4A3A1A",
      negative: "#4A2529",
      neutral: "#33304A",
      info: "#1B3A4A",
    },
  },

  category: {
    pastelLavender: "#3A2F66",
    pastelLavenderSoft: "#241E3D",
    pastelSky: "#1B3B52",
    pastelSkySoft: "#152A3A",
    pastelMint: "#1B4A38",
    pastelMintSoft: "#153529",
    pastelPeach: "#4A3A22",
    pastelPeachSoft: "#332A1B",
    pastelRose: "#4A2530",
    pastelRoseSoft: "#331B22",
    pastelViolet: "#3D2E63",
    pastelVioletSoft: "#271F42",
    pastelAqua: "#1B4444",
    pastelAquaSoft: "#153030",
    pastelLime: "#3A4420",
    pastelLimeSoft: "#28301A",
    accentPurple: "#9C8FFF",
    accentBlue: "#5B9EFF",
    accentGreen: "#34D399",
    accentTeal: "#2DD4BF",
    accentOrange: "#FB923C",
    accentRed: "#F87171",
    accentPink: "#F472B6",
    accentAmber: "#FBBF24",
    accentViolet: "#A78BFA",
    accentSlate: "#94A3B8",
  },

}
