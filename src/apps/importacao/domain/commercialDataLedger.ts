import type {
  ClassifiedCommercialImport,
  CommercialDataLedger,
  CommercialLedgerMergeStatistics,
  CommercialPeriodOption,
} from "../types/spreadsheetImport";

export const EMPTY_COMMERCIAL_LEDGER: CommercialDataLedger = {
  version: 1,
  attendance: [],
  serviceOrders: [],
  sales: [],
  renewals: [],
  cancellations: [],
  reactivations: [],
};

function mergeById<T extends { id: string }>(current: ReadonlyArray<T>, incoming: ReadonlyArray<T>): ReadonlyArray<T> {
  const records = new Map(current.map((record) => [record.id, record]));
  for (const record of incoming) records.set(record.id, record);
  return [...records.values()];
}

function mergeCommercialEvents<T extends { id: string; businessKey?: string }>(
  current: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
): ReadonlyArray<T> {
  const records = new Map(current.map((record) => [record.businessKey ?? record.id, record]));
  for (const record of incoming) records.set(record.businessKey ?? record.id, record);
  return [...records.values()];
}

function replaceEventsForImportedProtocols<T extends { id: string; businessKey?: string }>(
  current: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
  importedProtocols: ReadonlySet<string>,
): ReadonlyArray<T> {
  return mergeCommercialEvents(current.filter((event) => !importedProtocols.has(event.id)), incoming);
}

export function mergeCommercialLedger(
  current: CommercialDataLedger,
  incoming: ClassifiedCommercialImport,
): { ledger: CommercialDataLedger; statistics: CommercialLedgerMergeStatistics } {
  const attendanceIds = new Set(current.attendance.map((record) => record.id));
  const serviceOrderIds = new Set(current.serviceOrders.map((record) => record.id));
  const importedProtocols = new Set(incoming.attendance.map((record) => record.id));
  const importedServiceOrderMonths = new Set(incoming.serviceOrders.map((record) => commercialMonthKey(record.date)));

  return {
    ledger: {
      version: 1,
      attendance: mergeById(current.attendance, incoming.attendance),
      serviceOrders: mergeById(current.serviceOrders, incoming.serviceOrders),
      sales: mergeCommercialEvents(current.sales.filter((event) => !importedProtocols.has(event.attendanceId ?? event.id)), incoming.sales),
      renewals: replaceEventsForImportedProtocols(current.renewals, incoming.renewals, importedProtocols),
      cancellations: replaceEventsForImportedProtocols(current.cancellations, incoming.cancellations, importedProtocols),
      reactivations: mergeById(
        current.reactivations.filter((event) => !importedServiceOrderMonths.has(commercialMonthKey(event.date))),
        incoming.reactivations,
      ),
    },
    statistics: {
      attendanceAdded: incoming.attendance.filter((record) => !attendanceIds.has(record.id)).length,
      attendanceUpdated: incoming.attendance.filter((record) => attendanceIds.has(record.id)).length,
      serviceOrdersAdded: incoming.serviceOrders.filter((record) => !serviceOrderIds.has(record.id)).length,
      serviceOrdersUpdated: incoming.serviceOrders.filter((record) => serviceOrderIds.has(record.id)).length,
    },
  };
}

export function commercialMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(periodKey: string): { start: Date; end: Date } {
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("O período selecionado é inválido.");
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function formatMonthLabel(periodKey: string): string {
  const { start } = monthRange(periodKey);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(start);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function listCommercialLedgerPeriods(ledger: CommercialDataLedger): ReadonlyArray<CommercialPeriodOption> {
  const keys = new Set(ledger.attendance.map((record) => commercialMonthKey(record.date)));
  return [...keys].sort((a, b) => b.localeCompare(a)).map((value) => ({ value, label: formatMonthLabel(value) }));
}

export function selectCommercialLedgerMonth(
  ledger: CommercialDataLedger,
  periodKey: string,
  source?: ClassifiedCommercialImport,
): ClassifiedCommercialImport {
  const range = monthRange(periodKey);
  const inPeriod = (date: Date) => date >= range.start && date <= range.end;
  const attendance = ledger.attendance.filter((record) => inPeriod(record.date));
  const sales = ledger.sales.filter((event) => inPeriod(event.date));
  const renewals = ledger.renewals.filter((event) => inPeriod(event.date));
  const cancellations = ledger.cancellations.filter((event) => inPeriod(event.date));
  const reactivations = ledger.reactivations.filter((event) => inPeriod(event.date));
  const serviceOrders = ledger.serviceOrders.filter((record) => inPeriod(record.date));
  const classifiedProtocols = new Set([
    ...sales.map((event) => event.attendanceId ?? event.id),
    ...renewals.map((event) => event.id),
    ...cancellations.map((event) => event.id),
  ]);

  return {
    attendanceFileName: source?.attendanceFileName ?? "Histórico local",
    serviceOrderFileName: source?.serviceOrderFileName ?? "Histórico local",
    attendanceRows: attendance.length,
    serviceOrderRows: serviceOrders.length,
    linkedServiceOrders: attendance.filter((record) => record.linkedServiceOrder).length,
    ignoredAttendanceRows: Math.max(0, attendance.length - classifiedProtocols.size),
    periodStart: range.start,
    periodEnd: range.end,
    periodKey,
    attendance,
    serviceOrders,
    sales,
    renewals,
    cancellations,
    reactivations,
    warnings: source?.warnings ?? [],
  };
}

export function selectCommercialLedgerPeriod(
  ledger: CommercialDataLedger,
  imported: ClassifiedCommercialImport,
): ClassifiedCommercialImport {
  return selectCommercialLedgerMonth(ledger, commercialMonthKey(imported.periodEnd), imported);
}
