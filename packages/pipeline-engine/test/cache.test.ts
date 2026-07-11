import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { nodeFingerprint, PipelineCache } from '../src';
import { linearProject } from './fixtures';

const batch: DataBatch = { schema: { columns: [] }, rows: [], offset: 0 };

describe('PipelineCache', () => {
  it('returns only exact fingerprint matches', () => {
    const cache = new PipelineCache();
    cache.set('filter', 'v1', batch);

    expect(cache.get('filter', 'v1')).toBe(batch);
    expect(cache.get('filter', 'v2')).toBeUndefined();
  });

  it('invalidates a changed node and only its downstream nodes', () => {
    const cache = new PipelineCache();
    for (const node of linearProject.nodes) cache.set(node.id, 'v1', batch);

    expect(cache.invalidateDownstream(linearProject, ['filter'])).toEqual([
      'filter',
      'output',
    ]);
    expect(cache.get('input', 'v1')).toBe(batch);
    expect(cache.get('filter', 'v1')).toBeUndefined();
    expect(cache.get('output', 'v1')).toBeUndefined();
  });

  it('creates stable fingerprints independent of object key order', () => {
    const node = linearProject.nodes[1]!;
    const reordered = {
      ...node,
      config: { predicate: { value: true, type: 'literal' } },
    };

    expect(nodeFingerprint(node, ['source-v1'])).toBe(
      nodeFingerprint(reordered, ['source-v1']),
    );
    expect(nodeFingerprint(node, ['source-v1'])).not.toBe(
      nodeFingerprint(node, ['source-v2']),
    );
  });
});
