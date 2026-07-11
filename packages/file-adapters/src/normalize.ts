import type {
  CellValue,
  ColumnType,
  DataBatch,
  DataColumn,
} from '@luke/contracts';

const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T/u;
const numberValue = /^-?(?:\d+\.?\d*|\.\d+)$/u;

const toColumnId = (name: string, index: number): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
  return `${slug || 'column'}-${index + 1}`;
};

const coerceString = (value: string): CellValue => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (numberValue.test(trimmed)) return Number(trimmed);
  return value;
};

const cellType = (value: CellValue): ColumnType => {
  if (value === null) return 'unknown';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (isoDate.test(value)) return 'date';
  if (isoDateTime.test(value) && !Number.isNaN(Date.parse(value))) {
    return 'datetime';
  }
  return 'string';
};

const mergeTypes = (types: ColumnType[]): ColumnType => {
  const concrete = new Set(types.filter((type) => type !== 'unknown'));
  if (concrete.size === 0) return 'unknown';
  if (concrete.size === 1) return [...concrete][0] ?? 'unknown';
  return 'string';
};

export function recordsToBatch(
  records: Record<string, unknown>[],
  columnNames?: string[],
): DataBatch {
  const names =
    columnNames ??
    Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const rows = records.map((record) =>
    names.map((name) => {
      const value = record[name];
      if (value === undefined || value === null) return null;
      if (typeof value === 'string') return coerceString(value);
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      return JSON.stringify(value);
    }),
  );
  const columns: DataColumn[] = names.map((name, index) => {
    const values = rows.map((row) => row[index] ?? null);
    return {
      id: toColumnId(name, index),
      name,
      type: mergeTypes(values.map(cellType)),
      nullable: values.some((value) => value === null),
    };
  });

  return {
    schema: { columns },
    rows,
    offset: 0,
    totalRows: rows.length,
  };
}
