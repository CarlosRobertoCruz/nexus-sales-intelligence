import type { CommercialDashboardBundle } from "@/core/types/commercialDashboard";
import type {
  ClassifiedCancellation,
  ClassifiedReactivation,
  ClassifiedRenewal,
  ClassifiedSale,
  CommercialDataLedger,
  ProcessedAttendance,
  ProcessedServiceOrder,
} from "../types/spreadsheetImport";

const DATABASE_NAME = "nexus-sales-intelligence";
const DATABASE_VERSION = 2;
const DASHBOARD_STORE = "dashboard";
const ATTENDANCE_STORE = "attendance";
const SERVICE_ORDER_STORE = "service-orders";
const SALES_STORE = "sales";
const RENEWALS_STORE = "renewals";
const CANCELLATIONS_STORE = "cancellations";
const REACTIVATIONS_STORE = "reactivations";
const LEGACY_INDEXED_STORE = "commercial-data";
const DASHBOARD_KEY = "current";
const LEGACY_DASHBOARD_KEY = "nexus-sales-intelligence:commercial-dashboard:v1";
const LEGACY_LEDGER_KEY = "nexus-sales-intelligence:commercial-data-ledger:v1";

const RECORD_STORES = [
  ATTENDANCE_STORE,
  SERVICE_ORDER_STORE,
  SALES_STORE,
  RENEWALS_STORE,
  CANCELLATIONS_STORE,
  REACTIVATIONS_STORE,
] as const;
const ALL_STORES = [DASHBOARD_STORE, ...RECORD_STORES] as const;

type SerializedDate<T extends { date: Date }> = Omit<T, "date"> & { date: string };
type SerializedCommercialDataLedger = {
  version: 1;
  attendance: ReadonlyArray<SerializedDate<ProcessedAttendance>>;
  serviceOrders: ReadonlyArray<SerializedDate<ProcessedServiceOrder>>;
  sales: ReadonlyArray<SerializedDate<ClassifiedSale>>;
  renewals: ReadonlyArray<SerializedDate<ClassifiedRenewal>>;
  cancellations: ReadonlyArray<SerializedDate<ClassifiedCancellation>>;
  reactivations: ReadonlyArray<SerializedDate<ClassifiedReactivation>>;
};

type PersistedRecord = { id: string; date: string } & Record<string, unknown>;

export type PersistedCommercialData = {
  dashboard: CommercialDashboardBundle | null;
  ledger: CommercialDataLedger | null;
};

function hasDashboardShape(value: unknown): value is CommercialDashboardBundle {
  return Boolean(value && typeof value === "object" && "version" in value && value.version === 1);
}

function hasLedgerShape(value: unknown): value is SerializedCommercialDataLedger {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SerializedCommercialDataLedger>;
  return candidate.version === 1
    && Array.isArray(candidate.attendance)
    && Array.isArray(candidate.serviceOrders)
    && Array.isArray(candidate.sales)
    && Array.isArray(candidate.renewals)
    && Array.isArray(candidate.cancellations)
    && Array.isArray(candidate.reactivations);
}

function serializeRecord<T extends { date: Date }>(record: T): SerializedDate<T> {
  return { ...record, date: record.date.toISOString() };
}

function hydrateDate<T extends { date: Date }>(record: SerializedDate<T>): T {
  return { ...record, date: new Date(record.date) } as T;
}

function hydrateSale(record: SerializedDate<ClassifiedSale>): ClassifiedSale {
  return { ...hydrateDate(record), withdrawn: record.withdrawn ?? false };
}

function hydrateServiceOrder(record: SerializedDate<ProcessedServiceOrder>): ProcessedServiceOrder {
  const parsedDate = new Date(record.date);
  if (!Number.isNaN(parsedDate.getTime())) return { ...record, date: parsedDate };
  const period = record.periodKey.match(/^(\d{4})-(\d{2})/);
  return { ...record, date: period ? new Date(Number(period[1]), Number(period[2]) - 1, 1) : new Date(0) };
}

function hydrateSerializedLedger(value: unknown): CommercialDataLedger | null {
  if (!hasLedgerShape(value)) return null;
  return {
    version: 1,
    attendance: value.attendance.map(hydrateDate<ProcessedAttendance>),
    serviceOrders: value.serviceOrders.map(hydrateServiceOrder),
    sales: value.sales.map(hydrateSale),
    renewals: value.renewals.map(hydrateDate<ClassifiedRenewal>),
    cancellations: value.cancellations.map(hydrateDate<ClassifiedCancellation>),
    reactivations: value.reactivations.map(hydrateDate<ClassifiedReactivation>),
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao acessar o armazenamento local."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("A gravação local foi interrompida."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível gravar os dados localmente."));
  });
}

function createRecordStore(database: IDBDatabase, name: string): IDBObjectStore {
  const store = database.createObjectStore(name, { keyPath: "id" });
  store.createIndex("date", "date", { unique: false });
  if (name === SERVICE_ORDER_STORE) store.createIndex("periodKey", "periodKey", { unique: false });
  return store;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DASHBOARD_STORE)) database.createObjectStore(DASHBOARD_STORE);
      for (const storeName of RECORD_STORES) {
        if (!database.objectStoreNames.contains(storeName)) createRecordStore(database, storeName);
      }
      // A coleção antiga fica disponível durante a migração da versão 1.
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o banco local."));
    request.onblocked = () => reject(new Error("A atualização do banco local está bloqueada por outra aba aberta."));
  });
}

function loadLegacyLocalStorage(): PersistedCommercialData {
  try {
    const dashboardValue: unknown = JSON.parse(window.localStorage.getItem(LEGACY_DASHBOARD_KEY) ?? "null");
    const ledgerValue: unknown = JSON.parse(window.localStorage.getItem(LEGACY_LEDGER_KEY) ?? "null");
    return {
      dashboard: hasDashboardShape(dashboardValue) ? dashboardValue : null,
      ledger: hydrateSerializedLedger(ledgerValue),
    };
  } catch {
    return { dashboard: null, ledger: null };
  }
}

function clearLegacyLocalStorage(): void {
  window.localStorage.removeItem(LEGACY_DASHBOARD_KEY);
  window.localStorage.removeItem(LEGACY_LEDGER_KEY);
}

async function loadLegacyIndexedDb(database: IDBDatabase): Promise<PersistedCommercialData> {
  if (!database.objectStoreNames.contains(LEGACY_INDEXED_STORE)) return { dashboard: null, ledger: null };
  const transaction = database.transaction(LEGACY_INDEXED_STORE, "readonly");
  const completion = transactionDone(transaction);
  const store = transaction.objectStore(LEGACY_INDEXED_STORE);
  const [dashboardValue, ledgerValue] = await Promise.all([
    requestResult(store.get("dashboard")),
    requestResult(store.get("ledger")),
  ]);
  await completion;
  return {
    dashboard: hasDashboardShape(dashboardValue) ? dashboardValue : null,
    ledger: hydrateSerializedLedger(ledgerValue),
  };
}

async function readCurrentData(database: IDBDatabase): Promise<PersistedCommercialData> {
  const transaction = database.transaction(ALL_STORES, "readonly");
  const completion = transactionDone(transaction);
  const [dashboardValue, attendance, serviceOrders, sales, renewals, cancellations, reactivations] = await Promise.all([
    requestResult(transaction.objectStore(DASHBOARD_STORE).get(DASHBOARD_KEY)),
    requestResult(transaction.objectStore(ATTENDANCE_STORE).getAll()),
    requestResult(transaction.objectStore(SERVICE_ORDER_STORE).getAll()),
    requestResult(transaction.objectStore(SALES_STORE).getAll()),
    requestResult(transaction.objectStore(RENEWALS_STORE).getAll()),
    requestResult(transaction.objectStore(CANCELLATIONS_STORE).getAll()),
    requestResult(transaction.objectStore(REACTIVATIONS_STORE).getAll()),
  ]);
  await completion;

  const hasRecords = [attendance, serviceOrders, sales, renewals, cancellations, reactivations]
    .some((records) => records.length > 0);
  return {
    dashboard: hasDashboardShape(dashboardValue) ? dashboardValue : null,
    ledger: hasRecords ? {
      version: 1,
      attendance: (attendance as SerializedDate<ProcessedAttendance>[]).map(hydrateDate<ProcessedAttendance>),
      serviceOrders: (serviceOrders as SerializedDate<ProcessedServiceOrder>[]).map(hydrateServiceOrder),
      sales: (sales as SerializedDate<ClassifiedSale>[]).map(hydrateSale),
      renewals: (renewals as SerializedDate<ClassifiedRenewal>[]).map(hydrateDate<ClassifiedRenewal>),
      cancellations: (cancellations as SerializedDate<ClassifiedCancellation>[]).map(hydrateDate<ClassifiedCancellation>),
      reactivations: (reactivations as SerializedDate<ClassifiedReactivation>[]).map(hydrateDate<ClassifiedReactivation>),
    } : null,
  };
}

function replaceStore<T extends { date: Date }>(store: IDBObjectStore, records: ReadonlyArray<T>): void {
  store.clear();
  for (const record of records) store.put(serializeRecord(record) as PersistedRecord);
}

async function writeCommercialData(
  database: IDBDatabase,
  values: { dashboard?: CommercialDashboardBundle; ledger?: CommercialDataLedger },
): Promise<void> {
  const stores = values.ledger ? ALL_STORES : [DASHBOARD_STORE];
  const transaction = database.transaction(stores, "readwrite");
  const completion = transactionDone(transaction);
  if (values.dashboard) transaction.objectStore(DASHBOARD_STORE).put(values.dashboard, DASHBOARD_KEY);
  if (values.ledger) {
    replaceStore(transaction.objectStore(ATTENDANCE_STORE), values.ledger.attendance);
    replaceStore(transaction.objectStore(SERVICE_ORDER_STORE), values.ledger.serviceOrders);
    replaceStore(transaction.objectStore(SALES_STORE), values.ledger.sales);
    replaceStore(transaction.objectStore(RENEWALS_STORE), values.ledger.renewals);
    replaceStore(transaction.objectStore(CANCELLATIONS_STORE), values.ledger.cancellations);
    replaceStore(transaction.objectStore(REACTIVATIONS_STORE), values.ledger.reactivations);
  }
  await completion;
}

export async function loadCommercialData(): Promise<PersistedCommercialData> {
  const database = await openDatabase();
  try {
    const current = await readCurrentData(database);
    if (current.dashboard || current.ledger) return current;

    const legacyIndexed = await loadLegacyIndexedDb(database);
    const legacy = legacyIndexed.dashboard || legacyIndexed.ledger ? legacyIndexed : loadLegacyLocalStorage();
    if (legacy.dashboard || legacy.ledger) {
      await writeCommercialData(database, {
        dashboard: legacy.dashboard ?? undefined,
        ledger: legacy.ledger ?? undefined,
      });
      clearLegacyLocalStorage();
    }
    return legacy;
  } finally {
    database.close();
  }
}

export async function saveCommercialDashboard(dashboard: CommercialDashboardBundle): Promise<void> {
  const database = await openDatabase();
  try {
    await writeCommercialData(database, { dashboard });
  } finally {
    database.close();
  }
}

export async function saveCommercialData(ledger: CommercialDataLedger, dashboard: CommercialDashboardBundle): Promise<void> {
  const database = await openDatabase();
  try {
    await writeCommercialData(database, { ledger, dashboard });
  } finally {
    database.close();
  }
}

export async function clearCommercialData(): Promise<void> {
  const database = await openDatabase();
  try {
    const storeNames = database.objectStoreNames.contains(LEGACY_INDEXED_STORE)
      ? [...ALL_STORES, LEGACY_INDEXED_STORE]
      : [...ALL_STORES];
    const transaction = database.transaction(storeNames, "readwrite");
    const completion = transactionDone(transaction);
    for (const storeName of storeNames) transaction.objectStore(storeName).clear();
    await completion;
    clearLegacyLocalStorage();
  } finally {
    database.close();
  }
}
