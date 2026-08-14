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
