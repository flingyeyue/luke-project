import type { CellValue, DataBatch, NodeConfigByKind } from '@luke/contracts';
import Papa from 'papaparse';

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  content: string;
}

const spreadsheetFormula = /^[\t\r ]*[=+\-@]/u;

export function exportCsv(
  batch: DataBatch,
  config: NodeConfigByKind['output.csv'],
): ExportedFile {
  const fields = batch.schema.columns.map((column) => column.name);
  const data = batch.rows.map((row) =>
    row.map((value) => protectSpreadsheetCell(value)),
  );
  return {
    fileName: config.fileName,
    mimeType: 'text/csv;charset=utf-8',
    content: Papa.unparse(config.includeHeader ? { fields, data } : data, {
      delimiter: config.delimiter,
      header: config.includeHeader,
      newline: '\r\n',
    }),
  };
}

export function exportJson(
  batch: DataBatch,
  config: NodeConfigByKind['output.json'],
): ExportedFile {
  const records = batch.rows.map((row) =>
    Object.fromEntries(
      batch.schema.columns.map((column, index) => [
        column.name,
        row[index] ?? null,
      ]),
    ),
  );
  return {
    fileName: config.fileName,
    mimeType: 'application/json;charset=utf-8',
    content: JSON.stringify(records, null, config.pretty ? 2 : undefined),
  };
}

export function protectSpreadsheetCell(value: CellValue): CellValue {
  if (typeof value === 'string' && spreadsheetFormula.test(value)) {
    return `'${value}`;
  }
  return value;
}
