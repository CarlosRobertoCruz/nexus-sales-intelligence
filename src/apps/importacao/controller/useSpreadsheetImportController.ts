import { useEffect, useState } from "react";
import type { CommercialDashboardBundle } from "@/core/types/commercialDashboard";
import { buildLocationMetrics } from "@/apps/localidades/domain/buildLocationMetrics";
import { classifyCommercialRows } from "../domain/classifyCommercialRows";
import { commercialMonthKey, EMPTY_COMMERCIAL_LEDGER, listCommercialLedgerPeriods, mergeCommercialLedger, selectCommercialLedgerMonth } from "../domain/commercialDataLedger";
import { clearCommercialData, loadCommercialData, saveCommercialDashboard, saveCommercialData } from "../services/commercialDashboardRepository";
import { readAndCombineImportedWorksheets } from "../services/excelImportService";
import type { ClassifiedCommercialImport, CommercialDataLedger, ImportStepStatus, SpreadsheetImportFiles, SpreadsheetReadProgress } from "../types/spreadsheetImport";
import { buildCommercialDashboard } from "../viewModel/buildCommercialDashboard";

const EMPTY_FILES: SpreadsheetImportFiles = {
  attendance: [],
  serviceOrders: [],
};

function yieldToInterface(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível processar as planilhas selecionadas.";
}

function buildDashboardForPeriod(ledger: CommercialDataLedger, periodKey: string, source?: ClassifiedCommercialImport): CommercialDashboardBundle {
  const periods = listCommercialLedgerPeriods(ledger);
  const currentIndex = periods.findIndex((period) => period.value === periodKey);
  const previousKey = currentIndex >= 0 ? periods[currentIndex + 1]?.value : undefined;
  const previousDashboard = previousKey ? buildCommercialDashboard(selectCommercialLedgerMonth(ledger, previousKey), null) : null;
  return buildCommercialDashboard(selectCommercialLedgerMonth(ledger, periodKey, source), previousDashboard);
}

export function useSpreadsheetImportController() {
  const [ledger, setLedger] = useState<CommercialDataLedger>(EMPTY_COMMERCIAL_LEDGER);
  const [dashboard, setDashboard] = useState<CommercialDashboardBundle | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [files, setFiles] = useState<SpreadsheetImportFiles>(EMPTY_FILES);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ImportStepStatus>("idle");
  const [readProgress, setReadProgress] = useState<SpreadsheetReadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadCommercialData()
      .then(async (stored) => {
        if (!active) return;
        const storedLedger = stored.ledger ?? EMPTY_COMMERCIAL_LEDGER;
        const periods = listCommercialLedgerPeriods(storedLedger);
        const savedPeriod = stored.dashboard?.meta.periodKey.slice(0, 7);
        const periodKey = periods.some((period) => period.value === savedPeriod) ? savedPeriod : periods[0]?.value;
        const hydratedDashboard = periodKey && (!stored.dashboard?.team || stored.dashboard.meta.periodKey.slice(0, 7) !== periodKey)
          ? buildDashboardForPeriod(storedLedger, periodKey)
          : stored.dashboard;
        if (hydratedDashboard && hydratedDashboard !== stored.dashboard) await saveCommercialDashboard(hydratedDashboard);
        if (!active) return;
        setLedger(storedLedger);
        setDashboard(hydratedDashboard);
        setSelectedPeriod(periodKey ?? null);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setIsHydrating(false);
      });
    return () => { active = false; };
  }, []);

  const isProcessing = isHydrating || status === "reading" || status === "processing" || status === "saving";
  const canImport = files.attendance.length > 0
    && files.serviceOrders.length > 0
    && !isProcessing;
  const availablePeriods = listCommercialLedgerPeriods(ledger);
  const dashboardPeriod = dashboard?.meta.periodKey.slice(0, 7) ?? "";
  const selectedPeriodValue = selectedPeriod
    ?? (availablePeriods.some((period) => period.value === dashboardPeriod) ? dashboardPeriod : availablePeriods[0]?.value ?? "");
  const locationMetrics = selectedPeriodValue ? buildLocationMetrics(ledger, selectedPeriodValue) : [];

  function openImport(): void {
    if (isHydrating) return;
    setFiles(EMPTY_FILES);
    setStatus("idle");
    setReadProgress(null);
    setError(null);
    setSummary(null);
    setIsOpen(true);
  }

  function closeImport(): void {
    if (!isProcessing) setIsOpen(false);
  }

  function selectAttendance(selectedFiles: ReadonlyArray<File>): void {
    setFiles((current) => ({ ...current, attendance: selectedFiles }));
    setError(null);
    setStatus("idle");
  }

  function selectServiceOrders(selectedFiles: ReadonlyArray<File>): void {
    setFiles((current) => ({ ...current, serviceOrders: selectedFiles }));
    setError(null);
    setStatus("idle");
  }

  function selectPeriod(periodKey: string): void {
    if (!availablePeriods.some((period) => period.value === periodKey)) return;
    const nextDashboard = buildDashboardForPeriod(ledger, periodKey);
    void saveCommercialDashboard(nextDashboard).catch((caught) => setError(errorMessage(caught)));
    setDashboard(nextDashboard);
    setSelectedPeriod(periodKey);
  }

  async function clearData(): Promise<void> {
    try {
      await clearCommercialData();
      setDashboard(null);
      setLedger(EMPTY_COMMERCIAL_LEDGER);
      setSelectedPeriod(null);
      setFiles(EMPTY_FILES);
      setIsOpen(false);
      setStatus("idle");
      setReadProgress(null);
      setError(null);
      setSummary(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function importSpreadsheets(): Promise<void> {
    if (!files.attendance.length || !files.serviceOrders.length) return;
    try {
      setError(null);
      setSummary(null);
      setStatus("reading");
      const totalFiles = files.attendance.length
        + files.serviceOrders.length;
      let currentFile = 0;
      const trackFile = (fileName: string) => {
        currentFile += 1;
        setReadProgress({ current: currentFile, total: totalFiles, fileName });
      };
      const attendance = await readAndCombineImportedWorksheets(files.attendance, "atendimentos", trackFile);
      const serviceOrders = await readAndCombineImportedWorksheets(files.serviceOrders, "ordens de serviço", trackFile);
      setStatus("processing");
      setReadProgress(null);
      await yieldToInterface();
      const classified = classifyCommercialRows(attendance, serviceOrders);
      const { ledger: nextLedger, statistics } = mergeCommercialLedger(ledger, classified);
      const activePeriodKey = commercialMonthKey(classified.periodEnd);
      const nextDashboard = buildDashboardForPeriod(nextLedger, activePeriodKey, classified);
      setStatus("saving");
      await yieldToInterface();
      await saveCommercialData(nextLedger, nextDashboard);
      setLedger(nextLedger);
      setDashboard(nextDashboard);
      setSelectedPeriod(activePeriodKey);
      setSummary([
        `${totalFiles.toLocaleString("pt-BR")} planilhas processadas`,
        `${classified.sales.length.toLocaleString("pt-BR")} vendas válidas`,
        `${statistics.attendanceAdded.toLocaleString("pt-BR")} atendimentos adicionados`,
        `${statistics.attendanceUpdated.toLocaleString("pt-BR")} atualizados`,
        `${statistics.serviceOrdersAdded.toLocaleString("pt-BR")} OS adicionadas`,
        `${statistics.serviceOrdersUpdated.toLocaleString("pt-BR")} atualizadas`,
      ].join(" · "));
      setStatus("success");
    } catch (caught) {
      setError(errorMessage(caught));
      setReadProgress(null);
      setStatus("error");
    }
  }

  return {
    dashboard,
    files,
    isOpen,
    status,
    error,
    summary,
    readProgress,
    isProcessing,
    isHydrating,
    canImport,
    availablePeriods,
    selectedPeriod: selectedPeriodValue,
    locationMetrics,
    openImport,
    closeImport,
    selectAttendance,
    selectServiceOrders,
    selectPeriod,
    clearData,
    importSpreadsheets,
  } as const;
}

export type SpreadsheetImportController = ReturnType<typeof useSpreadsheetImportController>;
