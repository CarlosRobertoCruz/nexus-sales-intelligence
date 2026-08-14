import { useMemo } from "react";
import { getEmptyCancellationsSnapshot } from "../services/cancellationsService";
import type { CancellationsSnapshot } from "../types/cancellations";
import { buildCancellationsViewModel } from "../viewModel/buildCancellationsViewModel";

export function useCancellationsController(snapshot?: CancellationsSnapshot) {
  const viewModel = useMemo(() => buildCancellationsViewModel(snapshot ?? getEmptyCancellationsSnapshot()), [snapshot]);
  return { viewModel, isLoading: false };
}
