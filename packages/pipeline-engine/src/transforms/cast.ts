import type {
  CellValue,
  ColumnType,
  DataBatch,
  Diagnostic,
  NodeConfigByKind,
} from '@luke/contracts';

import type { TransformResult } from './types';

const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

function isCalendarDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value
    .split('-')
    .map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function castValue(value: CellValue, target: ColumnType): CellValue {
  if (value === null) return null;
  switch (target) {
    case 'string':
      return String(value);
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value !== 'string' || value.trim() === '') throw new Error();
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error();
      return parsed;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string' && value.toLowerCase() === 'true') {
        return true;
      }
      if (typeof value === 'string' && value.toLowerCase() === 'false') {
        return false;
      }
      throw new Error();
    case 'date':
      if (typeof value !== 'string' || !isCalendarDate(value))
        throw new Error();
      return value;
    case 'datetime': {
      if (typeof value !== 'string') throw new Error();
      const timestamp = Date.parse(value);
      if (Number.isNaN(timestamp)) throw new Error();
      return new Date(timestamp).toISOString();
    }
    case 'unknown':
      return value;
  }
}

export function executeCast(
  input: DataBatch,
  config: NodeConfigByKind['transform.cast'],
  nodeId: string,
): TransformResult {
  const columns = input.schema.columns.map((column) => ({ ...column }));
  const rows = input.rows.map((row) => [...row]);
  const diagnostics: Diagnostic[] = [];
  const indexes = new Map(columns.map((column, index) => [column.id, index]));

  for (const [ruleIndex, rule] of config.rules.entries()) {
    const columnIndex = indexes.get(rule.columnId);
    if (columnIndex === undefined) {
      diagnostics.push({
        code: 'COLUMN_NOT_FOUND',
        severity: 'error',
        message: `Column ${rule.columnId} does not exist.`,
        nodeId,
        fieldPath: `config.rules.${ruleIndex}.columnId`,
        details: { columnId: rule.columnId },
      });
      continue;
    }

    columns[columnIndex] = {
      ...columns[columnIndex]!,
      type: rule.targetType,
      nullable: columns[columnIndex]!.nullable || rule.onError === 'null',
    };
    for (const [rowIndex, row] of rows.entries()) {
      const original = row[columnIndex] ?? null;
      try {
        row[columnIndex] = castValue(original, rule.targetType);
      } catch {
        const severity = rule.onError === 'fail' ? 'error' : 'warning';
        diagnostics.push({
          code: 'TYPE_CONVERSION_FAILED',
          severity,
          message: `Cannot convert value in ${rule.columnId} to ${rule.targetType}.`,
          nodeId,
          fieldPath: `config.rules.${ruleIndex}`,
          rowNumber: input.offset + rowIndex + 1,
          details: {
            columnId: rule.columnId,
            targetType: rule.targetType,
          },
        });
        if (rule.onError === 'null') row[columnIndex] = null;
        if (rule.onError === 'fail') {
          return {
            batch: input,
            diagnostics,
          };
        }
      }
    }
  }

  return {
    batch: {
      schema: { columns },
      rows,
      offset: input.offset,
      ...(input.totalRows === undefined ? {} : { totalRows: input.totalRows }),
    },
    diagnostics,
  };
}
