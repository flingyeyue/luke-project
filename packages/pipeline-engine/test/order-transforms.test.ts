import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { executeDeduplicate, executeSort, executeTransformNode } from '../src';

const batch: DataBatch = {
  schema: {
    columns: [
      { id: 'group', name: 'Group', type: 'string', nullable: false },
      { id: 'score', name: 'Score', type: 'number', nullable: true },
      { id: 'name', name: 'Name', type: 'string', nullable: false },
    ],
  },
  rows: [
    ['b', 2, 'B-first'],
    ['a', null, 'A-null'],
    ['a', 3, 'A-high-first'],
    ['a', 3, 'A-high-second'],
    ['b', 1, 'B-last'],
  ],
  offset: 0,
  totalRows: 5,
};

describe('executeSort', () => {
  it('sorts by multiple fields and preserves equal-row order', () => {
    const result = executeSort(
      batch,
      {
        rules: [
          { columnId: 'group', direction: 'asc', nulls: 'last' },
          { columnId: 'score', direction: 'desc', nulls: 'last' },
        ],
      },
      'sort-1',
    );

    expect(result.batch.rows.map((row) => row[2])).toEqual([
      'A-high-first',
      'A-high-second',
      'A-null',
      'B-first',
      'B-last',
    ]);
    expect(batch.rows[0]).toEqual(['b', 2, 'B-first']);
  });

  it('keeps null placement independent from descending direction', () => {
    const result = executeSort(
      batch,
      {
        rules: [{ columnId: 'score', direction: 'desc', nulls: 'first' }],
      },
      'sort-1',
    );

    expect(result.batch.rows[0]?.[2]).toBe('A-null');
  });

  it('rejects missing columns and mixed runtime types', () => {
    const missing = executeSort(
      batch,
      { rules: [{ columnId: 'missing', direction: 'asc', nulls: 'last' }] },
      'sort-1',
    );
    expect(missing.diagnostics[0]).toMatchObject({
      code: 'COLUMN_NOT_FOUND',
      nodeId: 'sort-1',
    });

    const mixed: DataBatch = {
      ...batch,
      rows: [
        ['a', 1, 'One'],
        ['a', '2', 'Two'],
      ],
    };
    const invalid = executeSort(
      mixed,
      { rules: [{ columnId: 'score', direction: 'asc', nulls: 'last' }] },
      'sort-1',
    );
    expect(invalid.batch).toBe(mixed);
    expect(invalid.diagnostics[0]).toMatchObject({
      code: 'SORT_COMPARISON_FAILED',
    });
  });
});

describe('executeDeduplicate', () => {
  const duplicates: DataBatch = {
    schema: batch.schema,
    rows: [
      ['a', 1, 'first-a1'],
      ['a', 1, 'last-a1'],
      ['a', 2, 'only-a2'],
      ['b', 1, 'only-b1'],
    ],
    offset: 0,
  };

  it('keeps the first row for each composite key', () => {
    const result = executeDeduplicate(
      duplicates,
      { columnIds: ['group', 'score'], keep: 'first' },
      'dedupe-1',
    );

    expect(result.batch.rows.map((row) => row[2])).toEqual([
      'first-a1',
      'only-a2',
      'only-b1',
    ]);
    expect(result.batch.totalRows).toBe(3);
  });

  it('keeps the last duplicate while preserving retained input order', () => {
    const result = executeDeduplicate(
      duplicates,
      { columnIds: ['group', 'score'], keep: 'last' },
      'dedupe-1',
    );

    expect(result.batch.rows.map((row) => row[2])).toEqual([
      'last-a1',
      'only-a2',
      'only-b1',
    ]);
  });

  it('distinguishes composite key value types and reports missing columns', () => {
    const typed: DataBatch = {
      ...duplicates,
      rows: [
        ['a', 1, 'number'],
        ['a', '1', 'string'],
      ],
    };
    expect(
      executeDeduplicate(
        typed,
        { columnIds: ['score'], keep: 'first' },
        'dedupe-1',
      ).batch.rows,
    ).toHaveLength(2);
    expect(
      executeDeduplicate(
        duplicates,
        { columnIds: ['missing'], keep: 'first' },
        'dedupe-1',
      ).diagnostics[0],
    ).toMatchObject({ code: 'COLUMN_NOT_FOUND', nodeId: 'dedupe-1' });
  });

  it('dispatches sort nodes through the transform registry', () => {
    const result = executeTransformNode(
      {
        id: 'sort-1',
        kind: 'transform.sort',
        label: 'Sort',
        position: { x: 0, y: 0 },
        config: {
          rules: [{ columnId: 'score', direction: 'asc', nulls: 'last' }],
        },
      },
      batch,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.batch.rows.at(-1)?.[2]).toBe('A-null');
  });
});
