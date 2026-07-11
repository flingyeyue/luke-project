import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { exportCsv, exportJson, protectSpreadsheetCell } from '../src';

const batch: DataBatch = {
  schema: {
    columns: [
      { id: 'name', name: 'name', type: 'string', nullable: false },
      { id: 'amount', name: 'amount', type: 'number', nullable: true },
      { id: 'note', name: 'note', type: 'string', nullable: true },
    ],
  },
  rows: [
    ['Ada', -12.5, '=2+3'],
    ['Lin', null, '  @SUM(A1:A2)'],
    ['Kai', 8, 'line,with,commas'],
  ],
  offset: 0,
  totalRows: 3,
};

describe('exportCsv', () => {
  it('preserves schema field order, delimiter, and CRLF encoding', () => {
    const result = exportCsv(batch, {
      delimiter: ';',
      includeHeader: true,
      fileName: 'orders.csv',
    });

    expect(result).toMatchObject({
      fileName: 'orders.csv',
      mimeType: 'text/csv;charset=utf-8',
    });
    expect(result.content.split('\r\n')).toEqual([
      'name;amount;note',
      "Ada;-12.5;'=2+3",
      "Lin;;'  @SUM(A1:A2)",
      'Kai;8;line,with,commas',
    ]);
  });

  it('omits the header when configured', () => {
    const result = exportCsv(batch, {
      delimiter: ',',
      includeHeader: false,
      fileName: 'orders.csv',
    });

    expect(result.content).not.toContain('name,amount,note');
    expect(result.content).toContain('Ada,-12.5');
  });

  it('escapes spreadsheet formulas without changing negative numbers', () => {
    expect(protectSpreadsheetCell('=cmd')).toBe("'=cmd");
    expect(protectSpreadsheetCell('\t+cmd')).toBe("'\t+cmd");
    expect(protectSpreadsheetCell('-cmd')).toBe("'-cmd");
    expect(protectSpreadsheetCell('@cmd')).toBe("'@cmd");
    expect(protectSpreadsheetCell(-12.5)).toBe(-12.5);
    expect(protectSpreadsheetCell('ordinary')).toBe('ordinary');
  });
});

describe('exportJson', () => {
  it('exports an array of objects in schema field order', () => {
    const result = exportJson(batch, {
      shape: 'array-of-objects',
      pretty: false,
      fileName: 'orders.json',
    });

    expect(result).toMatchObject({
      fileName: 'orders.json',
      mimeType: 'application/json;charset=utf-8',
    });
    expect(JSON.parse(result.content)).toEqual([
      { name: 'Ada', amount: -12.5, note: '=2+3' },
      { name: 'Lin', amount: null, note: '  @SUM(A1:A2)' },
      { name: 'Kai', amount: 8, note: 'line,with,commas' },
    ]);
    expect(result.content.startsWith('[{"name"')).toBe(true);
  });

  it('supports pretty output', () => {
    const result = exportJson(batch, {
      shape: 'array-of-objects',
      pretty: true,
      fileName: 'orders.json',
    });

    expect(result.content).toContain('\n  {\n    "name"');
  });
});
