import { useMemo } from "react";
import { getEmptyTeamSnapshot } from "../services/teamService";
import type { TeamSnapshot } from "../types/team";
import { buildTeamViewModel } from "../viewModel/buildTeamViewModel";

export function useTeamController(snapshot?: TeamSnapshot) {
  const viewModel = useMemo(() => buildTeamViewModel(snapshot ?? getEmptyTeamSnapshot()), [snapshot]);
  return { viewModel, isLoading: false };
}
