import { readSheet } from "read-excel-file/browser";
import type { ImportedWorksheet, SpreadsheetCell } from "../types/spreadsheetImport";

function asSpreadsheetCell(value: unknown): SpreadsheetCell {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) return value;
  return String(value);
}

export async function readImportedWorksheet(file: File): Promise<ImportedWorksheet> {
  const rows = await readSheet(file);
  return {
    fileName: file.name,
    rows: rows.map((row) => row.map(asSpreadsheetCell)),
  };
}

function normalizedHeader(row: ReadonlyArray<SpreadsheetCell>): string {
  return row.map((cell) => String(cell ?? "").trim().toLowerCase()).join("\u001f");
}

export async function readAndCombineImportedWorksheets(
  files: ReadonlyArray<File>,
  reportLabel: string,
  onFileStart?: (fileName: string) => void,
): Promise<ImportedWorksheet> {
  if (!files.length) throw new Error(`Selecione pelo menos uma planilha de ${reportLabel}.`);

  let header: ReadonlyArray<SpreadsheetCell> | null = null;
  let expectedHeader = "";
  const combinedRows: SpreadsheetCell[][] = [];

  const orderedFiles = [...files].sort((left, right) => (
    left.lastModified - right.lastModified
    || left.name.localeCompare(right.name, "pt-BR", { numeric: true })
  ));

  for (const file of orderedFiles) {
    onFileStart?.(file.name);
    const worksheet = await readImportedWorksheet(file);
    const [currentHeader, ...dataRows] = worksheet.rows;
    if (!currentHeader) throw new Error(`A planilha ${file.name} está vazia.`);

    const currentHeaderKey = normalizedHeader(currentHeader);
    if (header && currentHeaderKey !== expectedHeader) {
      throw new Error(`A planilha ${file.name} não possui o mesmo formato das demais planilhas de ${reportLabel}.`);
    }
    if (!header) {
      header = currentHeader;
      expectedHeader = currentHeaderKey;
    }
    for (const row of dataRows) combinedRows.push([...row]);
  }

  return {
    fileName: files.length === 1 ? files[0].name : `${files.length} planilhas de ${reportLabel}`,
    rows: [header ?? [], ...combinedRows],
  };
}
