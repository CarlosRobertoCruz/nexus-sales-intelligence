import type { CancellationReasonId, CommercialDashboardBundle, RenewalBenefitId, SalesPlanId, SellerId } from "@/core/types/commercialDashboard";

export type SpreadsheetCell = string | number | boolean | Date | null;
export type SpreadsheetMatrix = ReadonlyArray<ReadonlyArray<SpreadsheetCell>>;

export type ImportedWorksheet = {
  fileName: string;
  rows: SpreadsheetMatrix;
};

export type SpreadsheetImportFiles = {
  attendance: ReadonlyArray<File>;
  serviceOrders: ReadonlyArray<File>;
};

export type SpreadsheetReadProgress = {
  current: number;
  total: number;
  fileName: string;
};

export type SpreadsheetImportResult = {
  dashboard: CommercialDashboardBundle;
  summary: string;
};

export type ImportStepStatus = "idle" | "reading" | "processing" | "saving" | "success" | "error";

export type ClassifiedSale = {
  id: string;
  attendanceId?: string;
  businessKey?: string;
  date: Date;
  customer: string;
  planId: SalesPlanId;
  planLabel: string;
  sellerId: SellerId;
  sellerName: string;
  location: string;
  installed: boolean;
  withdrawn: boolean;
};

export type ClassifiedRenewal = {
  id: string;
  businessKey?: string;
  date: Date;
  customer: string;
  planLabel: string;
  benefitId: RenewalBenefitId;
  benefitLabel: string;
  sellerName: string;
  location: string;
  completed: boolean;
};

export type ClassifiedCancellation = {
  id: string;
  date: Date;
  customer: string;
  planLabel: string;
  reasonId: CancellationReasonId;
  reasonLabel: string;
  location: string;
  completed: boolean;
};

export type ClassifiedReactivation = {
  id: string;
  date: Date;
};

export type ProcessedAttendance = {
  id: string;
  date: Date;
  linkedServiceOrder: boolean;
};

export type ProcessedServiceOrder = {
  id: string;
  date: Date;
  periodKey: string;
};

export type CommercialPeriodOption = {
  value: string;
  label: string;
};

export type ClassifiedCommercialImport = {
  attendanceFileName: string;
  serviceOrderFileName: string;
  attendanceRows: number;
  serviceOrderRows: number;
  linkedServiceOrders: number;
  ignoredAttendanceRows: number;
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
  attendance: ReadonlyArray<ProcessedAttendance>;
  serviceOrders: ReadonlyArray<ProcessedServiceOrder>;
  sales: ReadonlyArray<ClassifiedSale>;
  renewals: ReadonlyArray<ClassifiedRenewal>;
  cancellations: ReadonlyArray<ClassifiedCancellation>;
  reactivations: ReadonlyArray<ClassifiedReactivation>;
  warnings: ReadonlyArray<string>;
};

export type CommercialDataLedger = {
  version: 1;
  attendance: ReadonlyArray<ProcessedAttendance>;
  serviceOrders: ReadonlyArray<ProcessedServiceOrder>;
  sales: ReadonlyArray<ClassifiedSale>;
  renewals: ReadonlyArray<ClassifiedRenewal>;
  cancellations: ReadonlyArray<ClassifiedCancellation>;
  reactivations: ReadonlyArray<ClassifiedReactivation>;
};

export type CommercialLedgerMergeStatistics = {
  attendanceAdded: number;
  attendanceUpdated: number;
  serviceOrdersAdded: number;
  serviceOrdersUpdated: number;
};
