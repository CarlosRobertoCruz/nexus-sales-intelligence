// Textos próprios da visão geral; mantém linguagem comercial fora da UI.
import type { SalesPlanId } from "../types/salesOverview";

export const SALES_OVERVIEW_COPY = {
  product: "Nexus Sales Intelligence",
  eyebrow: "Inteligência comercial",
  title: "Visão geral de vendas",
  description: "Uma leitura rápida do desempenho do mês e dos movimentos que pedem atenção.",
  currentPeriod: "Período atual",
  previousPeriod: "mês anterior",
  salesByPlan: "Vendas por plano",
  salesByPlanDescription: "Comparativo do mês atual com o período anterior.",
  planMix: "Concentração das vendas",
  planMixDescription: "Participação do plano líder no total vendido.",
  operationalPulse: "Pulso operacional",
  operationalPulseDescription: "Movimentos que ajudam a explicar a saúde da carteira.",
  printReport: "Imprimir relatório",
  printReportDescription: "Gera um PDF A4 completo com todas as abas e os três mapas, pronto para impressão.",
  printingReport: "Gerando PDF...",
  printReportError: "Não foi possível gerar o PDF. Tente novamente.",
  nav: ["Visão geral", "Vendas", "Renovações", "Cancelamentos", "Localidades", "Equipe comercial"],
} as const;

export const SALES_PLAN_LABELS: Record<SalesPlanId, { short: string; full: string }> = {
  "combo-plus": { short: "Combo Plus", full: "600 Mega Combo Plus" },
  "combo-total-plus": { short: "Total Plus", full: "600 Mega Combo Total Plus" },
  "combo-view": { short: "Combo View", full: "600 Mega Combo View" },
  "combo-ultra": { short: "Combo Ultra", full: "720 Mega Combo Ultra" },
  "power-plus": { short: "Power Plus", full: "900 Mega Power Plus" },
  "ultra-power": { short: "Ultra Power", full: "1 Giga Ultra Power" },
  "other": { short: "Outros", full: "Outros planos" },
};
