import type { CommercialDataLedger } from "@/apps/importacao/types/spreadsheetImport";
import type { CommercialLocationMetric } from "../types/locations";

function inMonth(date: Date, periodKey: string): boolean {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === periodKey;
}

function normalizedLocation(location: string | undefined): string {
  const value = location?.trim();
  return value && value !== "Não informada" ? value : "Localidade não informada";
}

export function buildLocationMetrics(ledger: CommercialDataLedger, periodKey: string): ReadonlyArray<CommercialLocationMetric> {
  const metrics = new Map<string, CommercialLocationMetric>();
  const getMetric = (location: string | undefined) => {
    const name = normalizedLocation(location);
    const current = metrics.get(name) ?? { location: name, sales: 0, renewals: 0, cancellations: 0 };
    metrics.set(name, current);
    return current;
  };

  for (const sale of ledger.sales.filter((event) => inMonth(event.date, periodKey))) getMetric(sale.location).sales += 1;
  for (const renewal of ledger.renewals.filter((event) => event.completed && inMonth(event.date, periodKey))) getMetric(renewal.location).renewals += 1;
  for (const cancellation of ledger.cancellations.filter((event) => event.completed && inMonth(event.date, periodKey))) getMetric(cancellation.location).cancellations += 1;

  return [...metrics.values()].filter((metric) => metric.sales + metric.renewals + metric.cancellations > 0);
}
