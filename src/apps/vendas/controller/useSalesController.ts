import { useMemo } from "react";
import { getEmptySalesSnapshot } from "../services/salesService";
import type { SalesSnapshot } from "../types/sales";
import { buildSalesViewModel } from "../viewModel/buildSalesViewModel";

export function useSalesController(snapshot?: SalesSnapshot) {
  const viewModel = useMemo(() => buildSalesViewModel(snapshot ?? getEmptySalesSnapshot()), [snapshot]);
  return { viewModel, isLoading: false };
}
