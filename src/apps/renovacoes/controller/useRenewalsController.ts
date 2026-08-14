import { useMemo } from "react";
import { getEmptyRenewalsSnapshot } from "../services/renewalsService";
import type { RenewalsSnapshot } from "../types/renewals";
import { buildRenewalsViewModel } from "../viewModel/buildRenewalsViewModel";

export function useRenewalsController(snapshot?: RenewalsSnapshot) {
  const viewModel = useMemo(() => buildRenewalsViewModel(snapshot ?? getEmptyRenewalsSnapshot()), [snapshot]);
  return { viewModel, isLoading: false };
}
