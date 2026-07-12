import type { CellValue, NodeConfigByKind } from '@luke/contracts';
import ExcelJS, { type CellValue as ExcelCellValue } from 'exceljs';

import { protectSpreadsheetCell } from './export';
import { recordsToBatch } from './normalize';
import type { ParsedSource } from './types';

type XlsxInputConfig = NodeConfigByKind['input.xlsx'];

export interface ExportedWorkbook {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}

export async function parseXlsxFile(
  file: File,
  config: XlsxInputConfig,
): Promise<ParsedSource> {
  return parseXlsxBuffer(await file.arrayBuffer(), config);
}

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
  config: XlsxInputConfig,
): Promise<ParsedSource> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return failure('The XLSX source is invalid or corrupted.');
  }
  const worksheet = config.sheetName
    ? workbook.getWorksheet(config.sheetName)
    : workbook.worksheets[0];
  if (!worksheet) {
    return failure(
      config.sheetName
        ? `Worksheet ${config.sheetName} does not exist.`
        : 'The workbook does not contain a worksheet.',
    );
  }

  const header = worksheet.getRow(config.headerRow);
  const columnCount = header.cellCount;
  if (columnCount === 0) return failure('The XLSX header row is empty.');
  const names = Array.from({ length: columnCount }, (_, index) => {
    const value = excelValue(header.getCell(index + 1).value);
    return value === null ? `Column ${index + 1}` : String(value);
  });
  const records: Record<string, unknown>[] = [];
  for (
    let rowNumber = config.headerRow + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const record = Object.fromEntries(
      names.map((name, index) => [
        name,
        excelValue(row.getCell(index + 1).value),
      ]),
    );
    if (Object.values(record).some((value) => value !== null))
      records.push(record);
  }
  return { batch: recordsToBatch(records, names), diagnostics: [] };
}

export async function exportXlsx(
  batch: ParsedSource['batch'],
  config: NodeConfigByKind['output.xlsx'],
): Promise<ExportedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(config.sheetName);
  worksheet.addRow(batch.schema.columns.map((column) => column.name));
  for (const row of batch.rows) {
    worksheet.addRow(
      row.map((value) => toExcelValue(protectSpreadsheetCell(value))),
    );
  }
  const content = await workbook.xlsx.writeBuffer();
  return {
    fileName: config.fileName,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: new Uint8Array(content),
  };
}

function excelValue(value: ExcelCellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if ('formula' in value || 'sharedFormula' in value) {
    const formula = 'formula' in value ? value.formula : value.sharedFormula;
    return `=${formula}`;
  }
  if ('text' in value) return value.text;
  if ('richText' in value)
    return value.richText.map((part) => part.text).join('');
  if ('error' in value) return value.error;
  return String(value);
}

function toExcelValue(value: CellValue): string | number | boolean | null {
  return value;
}

function failure(message: string): ParsedSource {
  return {
    batch: recordsToBatch([]),
    diagnostics: [{ code: 'SOURCE_PARSE_FAILED', severity: 'error', message }],
  };
}
