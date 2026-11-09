// Textos próprios da visão geral; mantém linguagem comercial fora da UI.
import type { SalesPlanId } from "../types/salesOverview";
import { COMMERCIAL_PLANS } from "../../../core/config/commercialPlans";

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

export const SALES_PLAN_LABELS = Object.fromEntries(COMMERCIAL_PLANS.map(plan => [plan.id, { short: plan.short, full: plan.label }])) as Record<SalesPlanId, { short: string; full: string }>;
