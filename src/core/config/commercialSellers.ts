import type { SellerId } from "../types/commercialDashboard";

// Keep historical identities stable when a seller leaves the company.
export const COMMERCIAL_SELLERS: ReadonlyArray<{ id: SellerId; name: string; pattern: RegExp }> = [
  { id: "beatriz", name: "Beatriz", pattern: /\bbeatriz\b/ },
  { id: "karini", name: "Karini", pattern: /\bkarini\b/ },
  { id: "giovanna", name: "Giovanna", pattern: /\bgiovann?a\b/ },
  { id: "sara", name: "Sara", pattern: /\bsara\b/ },
  { id: "luana", name: "Luana Mota de Souza", pattern: /\bluana\b/ },
];
