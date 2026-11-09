import type { SalesPlanId } from "../types/commercialDashboard";

// Product names are identities. Equal speeds do not imply equal products.
export const COMMERCIAL_PLANS: ReadonlyArray<{ id: SalesPlanId; label: string; short: string; pattern?: RegExp }> = [
  { id: "combo-plus", label: "600 Mega Combo Plus", short: "Combo Plus", pattern: /\b600\s*mega(?:\s*combo)?\s*plus\b/ },
  { id: "combo-total-plus", label: "600 Mega Combo Total Plus", short: "Total Plus", pattern: /\b600\s*mega\s*combo\s*total\s*plus\b/ },
  { id: "combo-view", label: "600 Mega Combo View", short: "Combo View", pattern: /\b600\s*mega\s*combo\s*view\b/ },
  { id: "combo-ultra", label: "720 Mega Combo Ultra", short: "Combo Ultra", pattern: /\b720\s*mega(?:\s*combo)?(?:\s*ultra|\s*plus)?\b/ },
  { id: "power-plus", label: "900 Mega Power Plus", short: "Power Plus", pattern: /\b900\s*mega(?:\s*power)?\s*plus\b/ },
  { id: "ultra-power", label: "1 Giga Ultra Power", short: "Ultra Power", pattern: /\b1\s*giga\s*ultra\s*power\b/ },
  { id: "nexus-essential", label: "600 Mega Nexus Essencial", short: "Nexus Essencial", pattern: /\b(?:600\s*mega\s*(?:nexus\s*)?essencial|nexus\s+essencial)\b/ },
  { id: "nexus-pro", label: "1 Giga Nexus Pro", short: "Nexus Pro", pattern: /\b(?:1\s*giga\s*nexus\s*pro|nexus\s*pro\s*1\s*giga)\b/ },
  { id: "nexus-family", label: "1 Giga Nexus Family", short: "Nexus Family", pattern: /\b(?:1\s*giga\s*nexus\s*family|nexus\s*family\s*1\s*giga)\b/ },
  { id: "nexus-gamer", label: "900 Mega Nexus Gamer", short: "Nexus Gamer", pattern: /\b(?:900\s*mega\s*nexus\s*gamer|nexus\s*gamer\s*900\s*mega)\b/ },
  { id: "ultra-internet", label: "1 Giga Ultra — somente internet", short: "Ultra Internet", pattern: /\b1\s*giga\s*ultra\s*[-–—:]?\s*somente\s*internet\b/ },
  { id: "900-apps", label: "900 Mega + Standard + Premium (nome não informado)", short: "900 Mega + apps", pattern: /\b900\s*mega\s*\+\s*1\s*aplicativo\s*standard\s*\+\s*1\s*aplicativo\s*premium\b/ },
  { id: "other", label: "Outros planos", short: "Não identificados" },
];

export function recognizeCommercialPlan(value: string): { id: SalesPlanId; label: string } {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  // Prefer the explicitly declared product over incidental mentions in the rest of a ticket.
  const declared = normalized.match(/\bplano\s*:\s*([^,;\n]+)/)?.[1] ?? normalized;
  const plan = COMMERCIAL_PLANS.map(item => ({ item, match: item.pattern?.exec(declared) }))
    .filter(candidate => candidate.match)
    .sort((a, b) => a.match!.index - b.match!.index || b.match![0].length - a.match![0].length)[0]?.item;
  return plan ?? COMMERCIAL_PLANS[COMMERCIAL_PLANS.length - 1];
}
