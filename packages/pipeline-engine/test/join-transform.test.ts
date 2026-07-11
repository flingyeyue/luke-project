import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { executeJoin } from '../src';

const left: DataBatch = {
  schema: {
    columns: [
      { id: 'id', name: 'id', type: 'number', nullable: true },
      { id: 'name', name: 'name', type: 'string', nullable: false },
    ],
  },
  rows: [
    [1, 'A'],
    [2, 'B'],
    [null, 'Unknown'],
  ],
  offset: 0,
};
const right: DataBatch = {
  schema: {
    columns: [
      { id: 'order-id', name: 'id', type: 'number', nullable: false },
      { id: 'value', name: 'value', type: 'string', nullable: false },
    ],
  },
  rows: [
    [1, 'X'],
    [1, 'Y'],
    [3, 'Z'],
  ],
  offset: 0,
};

describe('executeJoin', () => {
  it('expands duplicate right keys for an inner join', () => {
    const result = executeJoin(
      left,
      right,
      {
        joinType: 'inner',
        leftKeys: ['id'],
        rightKeys: ['order-id'],
        rightColumnPrefix: 'right.',
      },
      'join-1',
    );
    expect(result.batch.rows).toEqual([
      [1, 'A', 1, 'X'],
      [1, 'A', 1, 'Y'],
    ]);
    expect(result.batch.schema.columns.map((column) => column.name)).toEqual([
      'id',
      'name',
      'right.id',
      'value',
    ]);
  });

  it('keeps unmatched and null-key left rows in a left join', () => {
    const result = executeJoin(
      left,
      right,
      {
        joinType: 'left',
        leftKeys: ['id'],
        rightKeys: ['order-id'],
        rightColumnPrefix: 'r.',
      },
      'join-1',
    );
    expect(result.batch.rows).toEqual([
      [1, 'A', 1, 'X'],
      [1, 'A', 1, 'Y'],
      [2, 'B', null, null],
      [null, 'Unknown', null, null],
    ]);
    expect(result.batch.schema.columns[2]).toMatchObject({ nullable: true });
  });

  it('supports typed composite keys', () => {
    const compositeRight: DataBatch = {
      schema: {
        columns: [
          ...right.schema.columns,
          { id: 'kind', name: 'kind', type: 'string', nullable: false },
        ],
      },
      rows: [
        [1, 'X', 'a'],
        [1, 'Y', 'b'],
      ],
      offset: 0,
    };
    const compositeLeft: DataBatch = {
      schema: {
        columns: [
          ...left.schema.columns,
          { id: 'kind', name: 'kind', type: 'string', nullable: false },
        ],
      },
      rows: [[1, 'A', 'b']],
      offset: 0,
    };
    const result = executeJoin(
      compositeLeft,
      compositeRight,
      {
        joinType: 'inner',
        leftKeys: ['id', 'kind'],
        rightKeys: ['order-id', 'kind'],
        rightColumnPrefix: 'r.',
      },
      'join-1',
    );
    expect(result.batch.rows).toEqual([[1, 'A', 'b', 1, 'Y', 'b']]);
  });

  it('reports missing keys and type mismatches', () => {
    expect(
      executeJoin(
        left,
        right,
        {
          joinType: 'inner',
          leftKeys: ['missing'],
          rightKeys: ['order-id'],
          rightColumnPrefix: 'r.',
        },
        'join-1',
      ).diagnostics[0],
    ).toMatchObject({ code: 'COLUMN_NOT_FOUND' });
    const mismatched = structuredClone(right);
    mismatched.schema.columns[0]!.type = 'string';
    expect(
      executeJoin(
        left,
        mismatched,
        {
          joinType: 'inner',
          leftKeys: ['id'],
          rightKeys: ['order-id'],
          rightColumnPrefix: 'r.',
        },
        'join-1',
      ).diagnostics[0],
    ).toMatchObject({ code: 'JOIN_KEY_TYPE_MISMATCH' });
  });
});
