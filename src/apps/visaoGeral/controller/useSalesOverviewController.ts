import { useCallback, useMemo, useState } from "react";
import type { CommercialDashboardBundle } from "@/core/types/commercialDashboard";
import type { CommercialLocationMetric } from "@/apps/localidades/types/locations";
import { getEmptySalesOverview } from "../services/salesOverviewService";
import { generateCommercialReportPdf } from "../services/salesOverviewPdfService";
import type { SalesOverviewSnapshot } from "../types/salesOverview";
import { buildSalesOverviewViewModel } from "../viewModel/buildSalesOverviewViewModel";

export function useSalesOverviewController(snapshot?: SalesOverviewSnapshot, dashboard?: CommercialDashboardBundle | null, locationMetrics: ReadonlyArray<CommercialLocationMetric> = []) {
  const viewModel = useMemo(() => buildSalesOverviewViewModel(snapshot ?? getEmptySalesOverview()), [snapshot]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const printReport = useCallback(async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportError(null);
    try {
      if (!dashboard) throw new Error("Não há dados importados para gerar o relatório.");
      await generateCommercialReportPdf({ overview: viewModel, dashboard, locationMetrics });
    } catch (error) {
      console.error("Falha ao gerar o relatório PDF da visão geral.", error);
      setExportError("pdf-export-failed");
    } finally {
      setIsExportingPdf(false);
    }
  }, [dashboard, isExportingPdf, locationMetrics, viewModel]);

  return { viewModel, isLoading: false, isExportingPdf, canPrintReport: Boolean(dashboard), exportError, printReport };
}
