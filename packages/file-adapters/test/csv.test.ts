import { describe, expect, it } from 'vitest';

import { parseCsvText } from '../src';

const config = {
  sourceId: 'orders',
  delimiter: 'auto',
  header: true,
  encoding: 'utf-8',
  skipEmptyLines: true,
} as const;

describe('parseCsvText', () => {
  it('parses headers, values and inferred types', () => {
    const result = parseCsvText('name,amount,active\nAda,42,true', config);

    expect(result.diagnostics).toEqual([]);
    expect(result.batch.schema.columns.map((column) => column.type)).toEqual([
      'string',
      'number',
      'boolean',
    ]);
    expect(result.batch.rows).toEqual([['Ada', 42, true]]);
  });

  it('returns an error for empty input', () => {
    expect(parseCsvText('  ', config).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'SOURCE_PARSE_FAILED',
        severity: 'error',
      }),
    );
  });

  it('reports missing fields with a row number', () => {
    const result = parseCsvText('name,amount\nAda', config);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'warning', rowNumber: 2 }),
    );
    expect(result.batch.rows).toEqual([['Ada', null]]);
  });

  it('supports an explicit tab delimiter', () => {
    const result = parseCsvText('name\tamount\nAda\t42', {
      ...config,
      delimiter: '\t',
    });

    expect(result.batch.rows).toEqual([['Ada', 42]]);
  });
});
