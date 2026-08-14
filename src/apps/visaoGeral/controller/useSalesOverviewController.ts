import { useMemo } from "react";
import { getEmptySalesOverview } from "../services/salesOverviewService";
import type { SalesOverviewSnapshot } from "../types/salesOverview";
import { buildSalesOverviewViewModel } from "../viewModel/buildSalesOverviewViewModel";

export function useSalesOverviewController(snapshot?: SalesOverviewSnapshot) {
  const viewModel = useMemo(() => buildSalesOverviewViewModel(snapshot ?? getEmptySalesOverview()), [snapshot]);
  return { viewModel, isLoading: false };
}
