import { lazy, Suspense } from "react";
import { serverMode } from "@/core/services/salesApi";
import { ServerAccess } from "@/apps/shell/ui/ServerAccess";

// Start the larger chart/report bundle after authentication, beneath the arrival screen.
const SalesDashboard = lazy(() => import("@/apps/shell/ui/SalesDashboard"));

export default function App() {
  const dashboard = (
    <Suspense
      fallback={
        <div role="status" className="sales-dashboard-loading">
          Carregando painel…
        </div>
      }
    >
      <SalesDashboard />
    </Suspense>
  );
  return serverMode ? <ServerAccess>{dashboard}</ServerAccess> : dashboard;
}
