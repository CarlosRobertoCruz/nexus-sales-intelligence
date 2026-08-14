import { Select } from "@/garden/foundations";
import { CalendarSearchIcon } from "@/garden/foundations/assets/icons/icons";
import type { SpreadsheetImportController } from "../controller/useSpreadsheetImportController";

export function CommercialPeriodSelector({ controller }: { controller: SpreadsheetImportController }) {
  return (
    <div style={{ minWidth: 188 }}>
      <Select
        aria-label="Selecionar mês de referência"
        value={controller.selectedPeriod}
        onChange={controller.selectPeriod}
        options={[...controller.availablePeriods]}
        startIcon={<CalendarSearchIcon />}
        size="lg"
        weight={600}
        placeholder="Nenhum período"
        disabled={!controller.availablePeriods.length}
      />
    </div>
  );
}
