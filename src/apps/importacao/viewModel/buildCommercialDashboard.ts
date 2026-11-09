import type { CancellationReasonId, CommercialDashboardBundle, RenewalBenefitId, SalesPlanId, SellerId } from "@/core/types/commercialDashboard";
import type { ClassifiedCommercialImport } from "../types/spreadsheetImport";
import { COMMERCIAL_SELLERS } from "../../../core/config/commercialSellers";
import { COMMERCIAL_PLANS } from "../../../core/config/commercialPlans";

const PLAN_ORDER = COMMERCIAL_PLANS;

const SELLER_ORDER = COMMERCIAL_SELLERS;

const BENEFIT_ORDER: ReadonlyArray<{ id: RenewalBenefitId; label: string }> = [
  { id: "bonus-speed", label: "Bônus de velocidade" },
  { id: "none", label: "Sem benefício adicional" },
  { id: "double-speed", label: "Dobro de velocidade" },
  { id: "upgrade", label: "Upgrade no plano" },
  { id: "discount", label: "Desconto" },
  { id: "downgrade", label: "Downgrade no plano" },
];

const REASON_ORDER: ReadonlyArray<{ id: CancellationReasonId; label: string; avoidable: boolean }> = [
  { id: "no-coverage", label: "Mudança para local sem cobertura", avoidable: false },
  { id: "dissatisfaction", label: "Insatisfação com o serviço", avoidable: true },
  { id: "existing-provider", label: "Outro provedor no endereço", avoidable: true },
  { id: "financial", label: "Motivo financeiro", avoidable: true },
  { id: "moving", label: "Mudança de endereço", avoidable: false },
  { id: "low-usage", label: "Pouco uso", avoidable: true },
  { id: "closed-business", label: "Fechamento do comércio", avoidable: false },
  { id: "other", label: "Outros motivos", avoidable: false },
];

function countBy<T>(values: ReadonlyArray<T>, key: (value: T) => string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
  return counts;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatUpdatedAt(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(date);
}

function formatReferencePeriod(start: Date, end: Date): string {
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const value = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(start);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return `${formatDate(start)} a ${formatDate(end)}`;
}

function periodKey(start: Date, end: Date): string {
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${iso(start)}__${iso(end)}`;
}

function monthLabel(start: Date): string {
  const value = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(start).replace(".", "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function previousPlan(previous: CommercialDashboardBundle | null, id: SalesPlanId): number {
  return previous?.overview.sales.find((plan) => plan.id === id)?.current ?? 0;
}

function previousSeller(previous: CommercialDashboardBundle | null, id: SellerId): number {
  return previous?.sales.sellers.find((seller) => seller.id === id)?.current ?? 0;
}

function previousLocation(previous: CommercialDashboardBundle | null, location: string): number {
  return previous?.cancellations.locations.find((item) => item.location === location)?.current ?? 0;
}

function sellerIdFromName(name: string): SellerId | null {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return SELLER_ORDER.find((seller) => seller.pattern.test(normalized))?.id ?? null;
}

export function buildCommercialDashboard(classified: ClassifiedCommercialImport, previous: CommercialDashboardBundle | null, now = new Date()): CommercialDashboardBundle {
  const referenceMonth = formatReferencePeriod(classified.periodStart, classified.periodEnd);
  const key = periodKey(classified.periodStart, classified.periodEnd);
  const validPrevious = previous?.meta.periodKey === key ? null : previous;
  const previousPeriodLabel = validPrevious?.meta.referenceMonth ?? "Sem período anterior";
  const updatedAt = formatUpdatedAt(now);
  const sourceLabel = "Dados importados";
  const countedRenewals = classified.renewals;
  const completedCancellations = classified.cancellations.filter((cancellation) => cancellation.completed);

  const salesByPlan = countBy(classified.sales, (sale) => sale.planId);
  const salesBySeller = countBy(classified.sales, (sale) => sale.sellerId);
  const renewalsByBenefit = countBy(countedRenewals, (renewal) => renewal.benefitId);
  const renewalsByPlan = countBy(countedRenewals, (renewal) => renewal.planLabel);
  const renewalsBySeller = countBy(countedRenewals, (renewal) => sellerIdFromName(renewal.sellerName) ?? "unknown");
  const cancellationsByReason = countBy(completedCancellations, (cancellation) => cancellation.reasonId);
  const cancellationsByLocation = countBy(completedCancellations, (cancellation) => cancellation.location);

  const overviewSales = PLAN_ORDER.map((plan) => ({ id: plan.id, current: salesByPlan.get(plan.id) ?? 0, previous: previousPlan(validPrevious, plan.id) }));
  const previousSalesTotal = validPrevious?.sales.plans.reduce((total, plan) => total + plan.current, 0) ?? 0;
  const previousRenewalsTotal = validPrevious?.renewals.benefits.reduce((total, benefit) => total + benefit.count, 0) ?? 0;
  const previousCancellationsTotal = validPrevious?.cancellations.reasons.reduce((total, reason) => total + reason.count, 0) ?? 0;

  const salesPlans = PLAN_ORDER.map((plan) => ({ label: plan.label, current: salesByPlan.get(plan.id) ?? 0, previous: previousPlan(validPrevious, plan.id) }));
  const sellers = SELLER_ORDER.map((seller) => ({ id: seller.id, name: seller.name, current: salesBySeller.get(seller.id) ?? 0, previous: previousSeller(validPrevious, seller.id) }));
  const teamMembers = SELLER_ORDER.map((seller) => {
    const previousMember = validPrevious?.team?.members.find((member) => member.id === seller.id);
    return {
      id: seller.id,
      name: seller.name,
      sales: salesBySeller.get(seller.id) ?? 0,
      previousSales: previousMember?.sales ?? previousSeller(validPrevious, seller.id),
      renewals: renewalsBySeller.get(seller.id) ?? 0,
      previousRenewals: previousMember?.renewals ?? 0,
    };
  });
  const benefits = BENEFIT_ORDER.map((benefit) => ({ id: benefit.id, label: benefit.label, count: renewalsByBenefit.get(benefit.id) ?? 0 }));
  const plans = [...renewalsByPlan.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (!plans.length) plans.push({ label: "Sem dados", count: 0 });
  const reasons = REASON_ORDER.map((reason) => ({ ...reason, count: cancellationsByReason.get(reason.id) ?? 0 }));
  const locations = [...cancellationsByLocation.entries()]
    .map(([location, current]) => ({ location, current, previous: previousLocation(validPrevious, location) }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 6);
  if (!locations.length) locations.push({ location: "Sem dados", current: 0, previous: 0 });

  const currentLabel = referenceMonth;
  const comparison = { currentPeriodLabel: currentLabel, previousPeriodLabel };
  const currentMonth = monthLabel(classified.periodStart);

  const dashboard: CommercialDashboardBundle = {
    version: 1,
    meta: {
      status: "imported",
      sourceLabel,
      periodKey: key,
      referenceMonth,
      currentPeriodLabel: currentLabel,
      previousPeriodLabel,
      importedAt: now.toISOString(),
      attendanceFileName: classified.attendanceFileName,
      serviceOrderFileName: classified.serviceOrderFileName,
      quality: {
        attendanceRows: classified.attendanceRows,
        serviceOrderRows: classified.serviceOrderRows,
        linkedServiceOrders: classified.linkedServiceOrders,
        ignoredAttendanceRows: classified.ignoredAttendanceRows,
        warnings: classified.warnings,
      },
    },
    overview: {
      sourceLabel,
      referenceMonth,
      updatedAt,
      sales: overviewSales,
      renewals: { current: countedRenewals.length, previous: previousRenewalsTotal },
      cancellations: { current: completedCancellations.length, previous: previousCancellationsTotal },
      reactivations: { current: classified.reactivations.length, previous: validPrevious?.overview.reactivations.current ?? 0 },
    },
    sales: {
      sourceLabel,
      ...comparison,
      referenceMonth,
      updatedAt,
      monthly: [{ month: currentMonth, currentYear: classified.sales.length, previousYear: previousSalesTotal }],
      plans: salesPlans,
      sellers,
      recentSales: [...classified.sales].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5).map((sale) => ({
        id: sale.id,
        date: formatDate(sale.date),
        customer: sale.customer,
        plan: sale.planLabel,
        seller: sale.sellerName,
        location: sale.location,
        status: sale.withdrawn ? "Desistência" : sale.installed ? "Instalado" : "Em ativação",
      })),
    },
    renewals: {
      sourceLabel,
      ...comparison,
      referenceMonth,
      updatedAt,
      monthly: [{ month: currentMonth, currentYear: countedRenewals.length, previousYear: previousRenewalsTotal }],
      benefits,
      plans,
      recentRenewals: [...classified.renewals].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5).map((renewal) => ({
        id: renewal.id,
        date: formatDate(renewal.date),
        customer: renewal.customer,
        plan: renewal.planLabel,
        benefit: renewal.benefitLabel,
        seller: renewal.sellerName,
        status: renewal.completed ? "Concluída" : "Pendente",
      })),
    },
    cancellations: {
      sourceLabel,
      ...comparison,
      referenceMonth,
      updatedAt,
      monthly: [{ month: currentMonth, currentYear: completedCancellations.length, previousYear: previousCancellationsTotal }],
      reasons,
      locations,
      recentCancellations: [...classified.cancellations].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5).map((cancellation) => ({
        id: cancellation.id,
        date: formatDate(cancellation.date),
        customer: cancellation.customer,
        reason: cancellation.reasonLabel,
        plan: cancellation.planLabel,
        location: cancellation.location,
        status: cancellation.completed ? "Concluído" : "Em análise",
      })),
      details: completedCancellations.map(cancellation => ({
        id: cancellation.id, date: formatDate(cancellation.date), customer: cancellation.customer,
        plan: cancellation.planLabel, location: cancellation.location, reasonId: cancellation.reasonId,
        openingReport: cancellation.detail?.openingReport ?? "",
        closingReport: cancellation.detail?.closingReport ?? "",
        orders: cancellation.detail?.orders ?? [], availableOrders: cancellation.detail?.availableOrders ?? 0,
      })).sort((a, b) => b.date.split("/").reverse().join("").localeCompare(a.date.split("/").reverse().join("")) || b.id.localeCompare(a.id)),
    },
    team: {
      sourceLabel,
      ...comparison,
      referenceMonth,
      updatedAt,
      members: teamMembers,
    },
  };

  return dashboard;
}
