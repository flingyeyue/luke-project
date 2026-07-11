import { describe, expect, it } from 'vitest';

import { parseJsonText } from '../src';

describe('parseJsonText', () => {
  it('parses an array of objects', () => {
    const result = parseJsonText('[{"name":"Ada","amount":42}]', {
      sourceId: 'source',
      flattenDepth: 0,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.batch.rows).toEqual([['Ada', 42]]);
  });

  it('selects a dotted root path', () => {
    const result = parseJsonText('{"payload":{"rows":[{"id":1}]}}', {
      sourceId: 'source',
      rootPath: 'payload.rows',
      flattenDepth: 0,
    });

    expect(result.batch.rows).toEqual([[1]]);
  });

  it('flattens one object level', () => {
    const result = parseJsonText('[{"user":{"name":"Ada"}}]', {
      sourceId: 'source',
      flattenDepth: 1,
    });

    expect(result.batch.schema.columns[0]?.name).toBe('user.name');
    expect(result.batch.rows).toEqual([['Ada']]);
  });

  it('rejects non-array roots and malformed JSON', () => {
    expect(
      parseJsonText('{"name":"Ada"}', {
        sourceId: 'source',
        flattenDepth: 0,
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ severity: 'error' }));

    expect(
      parseJsonText('{', { sourceId: 'source', flattenDepth: 0 }).diagnostics,
    ).toContainEqual(expect.objectContaining({ severity: 'error' }));
  });
});
