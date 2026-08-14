/**
 * Aparência de relatórios gerados (Excel no browser, PDF/jsPDF).
 * Espelha o DS (`color`) em formatos que essas libs consomem — sem semântica de feature.
 */

export type ReportExportToneKey = "brand" | "warning" | "success" | "info";

export const reportExport = {
  excelFontFamily: "Calibri" as const,
  pdfFontFamily: "helvetica" as const,

  /** Preenchimento da linha de valor do KPI no Excel: alpha baixo + hex da tonalidade. */
  excelKpiValueFillAlphaPrefix: "22" as const,

  /** Open XML ARGB (8 hex) para células Excel — alinhado a tokens de cor do DS. */
  excelArgb: {
    white: "FFFFFFFF",
    brandSoftSurface: "FFF3F0FF",
    zebraRow: "FFFAFAFA",
    borderHair: "FFE5E7EB",
    textMuted: "FF6b7280",
    brandStroke: "FF6d4aff",
  },

  /**
   * Hex sem `#` para cabeçalhos KPI no Excel (`FF` + hex) e RGB em PDF.
   * Tonalidades alinhadas a `TOKENS.color.brand.primary`, `feedback.warning`, etc.
   */
  toneHex: {
    brand: "6d4aff",
    warning: "f59e0b",
    success: "10b981",
    info: "0ea5e9",
  },

  toneRgb: {
    brand: [109, 74, 255],
    warning: [245, 158, 11],
    success: [16, 185, 129],
    info: [14, 165, 233],
  } as const satisfies Record<ReportExportToneKey, [number, number, number]>,

  pdfRgb: {
    contentPrimary: [17, 24, 39],
    contentMuted: [107, 114, 128],
    contentSubtle: [156, 163, 175],
    brandSurface: [243, 240, 255],
    /** Texto sobre fundos saturados (KPIs, cabeçalhos escuros) — espelha `content.inverse`. */
    inverse: [255, 255, 255],
  } as const,
};
