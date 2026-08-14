// Composição raiz das páginas disponíveis no painel.
import { useState } from "react";
import { CancellationsPage } from "@/apps/cancelamentos/ui/CancellationsPage";
import { TeamPage } from "@/apps/equipeComercial/ui/TeamPage";
import { useSpreadsheetImportController } from "@/apps/importacao/controller/useSpreadsheetImportController";
import { CommercialPeriodSelector } from "@/apps/importacao/ui/CommercialPeriodSelector";
import { SpreadsheetImportControl } from "@/apps/importacao/ui/SpreadsheetImportControl";
import { LocalitiesPage } from "@/apps/localidades/ui/LocalitiesPage";
import { AppShell } from "@/apps/shell/ui/AppShell";
import type { AppPage } from "@/apps/shell/copy/appShellCopy";
import { RenewalsPage } from "@/apps/renovacoes/ui/RenewalsPage";
import { SalesOverviewPage } from "@/apps/visaoGeral/ui/SalesOverviewPage";
import { SalesPage } from "@/apps/vendas/ui/SalesPage";

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("overview");
  const spreadsheetImport = useSpreadsheetImportController();
  const dashboard = spreadsheetImport.dashboard;
  const periodSelector = <CommercialPeriodSelector controller={spreadsheetImport} />;

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage} importControl={<SpreadsheetImportControl controller={spreadsheetImport} />}>
      {activePage === "locations" && <LocalitiesPage controller={spreadsheetImport} periodSelector={periodSelector} />}
      {activePage === "overview" && <SalesOverviewPage snapshot={dashboard?.overview} periodSelector={periodSelector} />}
      {activePage === "sales" && <SalesPage snapshot={dashboard?.sales} periodSelector={periodSelector} />}
      {activePage === "renewals" && <RenewalsPage snapshot={dashboard?.renewals} periodSelector={periodSelector} />}
      {activePage === "cancellations" && <CancellationsPage snapshot={dashboard?.cancellations} periodSelector={periodSelector} />}
      {activePage === "team" && <TeamPage snapshot={dashboard?.team} periodSelector={periodSelector} />}
    </AppShell>
  );
}
