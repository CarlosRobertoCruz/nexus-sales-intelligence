import type { TeamMemberPerformance } from "../types/team";

export function memberProduction(member: TeamMemberPerformance): number {
  return member.sales + member.renewals;
}

export function previousMemberProduction(member: TeamMemberPerformance): number {
  return member.previousSales + member.previousRenewals;
}

export function totalTeamProduction(members: ReadonlyArray<TeamMemberPerformance>): number {
  return members.reduce((total, member) => total + memberProduction(member), 0);
}

export function performanceGrowth(current: number, previous: number): number {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function performanceShare(value: number, total: number): number {
  return total ? (value / total) * 100 : 0;
}
