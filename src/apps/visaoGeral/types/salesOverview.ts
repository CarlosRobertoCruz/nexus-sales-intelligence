export type { SalesOverviewSnapshot, SalesPlanId, SalesPlanMetric } from "@/core/types/commercialDashboard";

export type SalesOverviewReportData = {
  sourceLabel: string;
  referenceMonth: string;
  updatedAt: string;
  summary: {
    sales: { value: string; trend: string };
    renewals: { value: string; trend: string };
    cancellations: { value: string; trend: string };
    reactivations: { value: string; trend: string };
  };
  plans: ReadonlyArray<{
    label: string;
    fullLabel: string;
    current: number;
    previous: number;
    growth: string;
    share: number;
  }>;
  leadingPlan: {
    label: string;
    percentage: number;
    value: number;
  };
};
