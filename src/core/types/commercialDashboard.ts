export type DataSourceStatus = "imported" | "empty";

export type ImportQuality = {
  attendanceRows: number;
  serviceOrderRows: number;
  linkedServiceOrders: number;
  ignoredAttendanceRows: number;
  warnings: ReadonlyArray<string>;
};

export type CommercialDataMeta = {
  status: DataSourceStatus;
  sourceLabel: string;
  periodKey: string;
  referenceMonth: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  importedAt: string;
  attendanceFileName: string;
  serviceOrderFileName: string;
  quality: ImportQuality;
};

export type SalesPlanId = "combo-plus" | "combo-total-plus" | "combo-view" | "combo-ultra" | "power-plus" | "ultra-power" | "other";
export type SalesPlanMetric = { id: SalesPlanId; current: number; previous: number };
export type SellerId = "beatriz" | "karini" | "giovanna" | "sara" | "unknown";
export type MonthlySales = { month: string; currentYear: number; previousYear: number };
export type PlanSales = { label: string; current: number; previous: number };
export type SellerSales = { id: SellerId; name: string; current: number; previous: number };
export type TeamMemberPerformance = {
  id: SellerId;
  name: string;
  sales: number;
  previousSales: number;
  renewals: number;
  previousRenewals: number;
};
export type RecentSale = { id: string; date: string; customer: string; plan: string; seller: string; location: string; status: "Instalado" | "Em ativação" | "Desistência" };

export type SalesSnapshot = {
  sourceLabel: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  referenceMonth: string;
  updatedAt: string;
  monthly: ReadonlyArray<MonthlySales>;
  plans: ReadonlyArray<PlanSales>;
  sellers: ReadonlyArray<SellerSales>;
  recentSales: ReadonlyArray<RecentSale>;
};

export type RenewalBenefitId = "bonus-speed" | "none" | "double-speed" | "upgrade" | "discount" | "downgrade";
export type MonthlyRenewals = { month: string; currentYear: number; previousYear: number };
export type BenefitRenewals = { id: RenewalBenefitId; label: string; count: number };
export type PlanRenewals = { label: string; count: number };
export type RecentRenewal = { id: string; date: string; customer: string; plan: string; benefit: string; seller: string; status: "Concluída" | "Em validação" };

export type RenewalsSnapshot = {
  sourceLabel: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  referenceMonth: string;
  updatedAt: string;
  monthly: ReadonlyArray<MonthlyRenewals>;
  benefits: ReadonlyArray<BenefitRenewals>;
  plans: ReadonlyArray<PlanRenewals>;
  recentRenewals: ReadonlyArray<RecentRenewal>;
};

export type CancellationReasonId = "no-coverage" | "dissatisfaction" | "existing-provider" | "low-usage" | "closed-business" | "financial" | "moving" | "other";
export type MonthlyCancellations = { month: string; currentYear: number; previousYear: number };
export type CancellationReason = { id: CancellationReasonId; label: string; count: number; avoidable: boolean };
export type LocationCancellations = { location: string; current: number; previous: number };
export type RecentCancellation = { id: string; date: string; customer: string; reason: string; plan: string; location: string; status: "Concluído" | "Em análise" };

export type CancellationsSnapshot = {
  sourceLabel: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  referenceMonth: string;
  updatedAt: string;
  monthly: ReadonlyArray<MonthlyCancellations>;
  reasons: ReadonlyArray<CancellationReason>;
  locations: ReadonlyArray<LocationCancellations>;
  recentCancellations: ReadonlyArray<RecentCancellation>;
};

export type SalesOverviewSnapshot = {
  sourceLabel: string;
  referenceMonth: string;
  updatedAt: string;
  sales: ReadonlyArray<SalesPlanMetric>;
  renewals: { current: number; previous: number };
  cancellations: { current: number; previous: number };
  reactivations: { current: number; previous: number };
};

export type TeamSnapshot = {
  sourceLabel: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  referenceMonth: string;
  updatedAt: string;
  members: ReadonlyArray<TeamMemberPerformance>;
};

export type CommercialDashboardBundle = {
  version: 1;
  meta: CommercialDataMeta;
  overview: SalesOverviewSnapshot;
  sales: SalesSnapshot;
  renewals: RenewalsSnapshot;
  cancellations: CancellationsSnapshot;
  team: TeamSnapshot;
};
