import type { Diagnostic, NodeConfigByKind } from '@luke/contracts';
import Papa from 'papaparse';

import { recordsToBatch } from './normalize';
import type { ParsedSource } from './types';

type CsvInputConfig = NodeConfigByKind['input.csv'];

export async function parseCsvFile(
  file: File,
  config: CsvInputConfig,
): Promise<ParsedSource> {
  return parseCsvText(await file.text(), config);
}

export function parseCsvText(
  text: string,
  config: CsvInputConfig,
): ParsedSource {
  if (text.trim() === '') {
    return {
      batch: recordsToBatch([]),
      diagnostics: [
        {
          code: 'SOURCE_PARSE_FAILED',
          severity: 'error',
          message: 'The CSV source is empty.',
        },
      ],
    };
  }

  const result = Papa.parse<Record<string, string | undefined>>(text, {
    delimiter: config.delimiter === 'auto' ? '' : config.delimiter,
    header: config.header,
    skipEmptyLines: config.skipEmptyLines,
  });
  const diagnostics: Diagnostic[] = result.errors.map((error) => ({
    code: 'SOURCE_PARSE_FAILED',
    severity: error.code === 'TooFewFields' ? 'warning' : 'error',
    message: error.message,
    ...(typeof error.row === 'number' ? { rowNumber: error.row + 2 } : {}),
    details: { parserCode: error.code },
  }));
  const fields = result.meta.fields ?? [];
  for (const [rowIndex, record] of result.data.entries()) {
    for (const field of fields) {
      if (record[field] === undefined) {
        diagnostics.push({
          code: 'SOURCE_PARSE_FAILED',
          severity: 'warning',
          message: `Missing value for column ${field}.`,
          rowNumber: rowIndex + 2,
          details: { column: field },
        });
      }
    }
  }

  return {
    batch: recordsToBatch(result.data, fields),
    diagnostics,
  };
}
