import type {
  CellValue,
  ColumnType,
  DataBatch,
  DataColumn,
  NodeConfigByKind,
} from '@luke/contracts';

import type { TransformResult } from './types';

type GroupConfig = NodeConfigByKind['aggregate.group'];
type Aggregate = GroupConfig['aggregates'][number];

interface GroupBucket {
  values: CellValue[];
  rows: DataBatch['rows'];
}

export function executeGroup(
  input: DataBatch,
  config: GroupConfig,
  nodeId: string,
): TransformResult {
  const indexes = new Map(
    input.schema.columns.map((column, index) => [column.id, index]),
  );
  const validation = validateConfig(input, config, nodeId, indexes);
  if (validation) return validation;

  const groupIndexes = config.groupBy.map((columnId) => indexes.get(columnId)!);
  const buckets = new Map<string, GroupBucket>();
  if (config.groupBy.length === 0) {
    buckets.set('all', { values: [], rows: [] });
  }
  for (const row of input.rows) {
    const values = groupIndexes.map((index) => row[index] ?? null);
    const key = JSON.stringify(values.map(typedValue));
    const bucket = buckets.get(key) ?? { values, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }

  try {
    const rows = [...buckets.values()].map((bucket) => [
      ...bucket.values,
      ...config.aggregates.map((aggregate) =>
        calculateAggregate(aggregate, bucket.rows, indexes),
      ),
    ]);
    return {
      batch: {
        schema: {
          columns: [
            ...config.groupBy.map(
              (columnId) => input.schema.columns[indexes.get(columnId)!]!,
            ),
            ...config.aggregates.map((aggregate, index) =>
              aggregateColumn(aggregate, index, nodeId, input, indexes),
            ),
          ],
        },
        rows,
        offset: 0,
        totalRows: rows.length,
      },
      diagnostics: [],
    };
  } catch (error) {
    return {
      batch: input,
      diagnostics: [
        {
          code: 'AGGREGATION_FAILED',
          severity: 'error',
          message:
            error instanceof Error ? error.message : 'Aggregation failed.',
          nodeId,
          fieldPath: 'config.aggregates',
        },
      ],
    };
  }
}

function validateConfig(
  input: DataBatch,
  config: GroupConfig,
  nodeId: string,
  indexes: Map<string, number>,
): TransformResult | undefined {
  for (const [index, columnId] of config.groupBy.entries()) {
    if (!indexes.has(columnId)) {
      return configError(input, nodeId, columnId, `config.groupBy.${index}`);
    }
  }
  for (const [index, aggregate] of config.aggregates.entries()) {
    if (aggregate.operation !== 'count' && !aggregate.columnId) {
      return configError(
        input,
        nodeId,
        '',
        `config.aggregates.${index}.columnId`,
        `${aggregate.operation} requires a column.`,
      );
    }
    if (aggregate.columnId && !indexes.has(aggregate.columnId)) {
      return configError(
        input,
        nodeId,
        aggregate.columnId,
        `config.aggregates.${index}.columnId`,
      );
    }
    if (aggregate.operation === 'sum' || aggregate.operation === 'avg') {
      const column = input.schema.columns[indexes.get(aggregate.columnId!)!]!;
      if (column.type !== 'number') {
        return configError(
          input,
          nodeId,
          aggregate.columnId!,
          `config.aggregates.${index}.columnId`,
          `${aggregate.operation} requires a number column.`,
          'AGGREGATION_CONFIG_INVALID',
        );
      }
    }
    if (aggregate.operation === 'min' || aggregate.operation === 'max') {
      const column = input.schema.columns[indexes.get(aggregate.columnId!)!]!;
      if (!['number', 'string', 'date', 'datetime'].includes(column.type)) {
        return configError(
          input,
          nodeId,
          aggregate.columnId!,
          `config.aggregates.${index}.columnId`,
          `${aggregate.operation} does not support ${column.type} columns.`,
          'AGGREGATION_CONFIG_INVALID',
        );
      }
    }
  }
}

function calculateAggregate(
  aggregate: Aggregate,
  rows: DataBatch['rows'],
  indexes: Map<string, number>,
): CellValue {
  if (aggregate.operation === 'count') {
    if (!aggregate.columnId) return rows.length;
    const index = indexes.get(aggregate.columnId)!;
    return rows.filter((row) => (row[index] ?? null) !== null).length;
  }
  const index = indexes.get(aggregate.columnId!)!;
  const values = rows
    .map((row) => row[index] ?? null)
    .filter((value): value is Exclude<CellValue, null> => value !== null);
  if (values.length === 0) return null;
  if (aggregate.operation === 'sum' || aggregate.operation === 'avg') {
    if (values.some((value) => typeof value !== 'number')) {
      throw new Error(`${aggregate.operation} encountered a non-number value.`);
    }
    const sum = (values as number[]).reduce((total, value) => total + value, 0);
    return aggregate.operation === 'sum' ? sum : sum / values.length;
  }
  if (
    values.some(
      (value) => typeof value !== 'number' && typeof value !== 'string',
    )
  ) {
    throw new Error(`${aggregate.operation} encountered an unsupported value.`);
  }
  const firstType = typeof values[0];
  if (values.some((value) => typeof value !== firstType)) {
    throw new Error(`${aggregate.operation} encountered mixed value types.`);
  }
  return values.reduce((selected, value) => {
    if (aggregate.operation === 'min')
      return value < selected ? value : selected;
    return value > selected ? value : selected;
  });
}

function aggregateColumn(
  aggregate: Aggregate,
  index: number,
  nodeId: string,
  input: DataBatch,
  indexes: Map<string, number>,
): DataColumn {
  const type: ColumnType =
    aggregate.operation === 'count' ||
    aggregate.operation === 'sum' ||
    aggregate.operation === 'avg'
      ? 'number'
      : input.schema.columns[indexes.get(aggregate.columnId!)!]!.type;
  return {
    id: `${nodeId}:aggregate:${index}`,
    name: aggregate.outputName,
    type,
    nullable: aggregate.operation !== 'count',
  };
}

function configError(
  input: DataBatch,
  nodeId: string,
  columnId: string,
  fieldPath: string,
  message = `Column ${columnId} does not exist.`,
  code: 'COLUMN_NOT_FOUND' | 'AGGREGATION_CONFIG_INVALID' = columnId
    ? 'COLUMN_NOT_FOUND'
    : 'AGGREGATION_CONFIG_INVALID',
): TransformResult {
  return {
    batch: input,
    diagnostics: [
      {
        code,
        severity: 'error',
        message,
        nodeId,
        fieldPath,
        ...(columnId ? { details: { columnId } } : {}),
      },
    ],
  };
}

function typedValue(value: CellValue): [string, CellValue] {
  return [value === null ? 'null' : typeof value, value];
}
