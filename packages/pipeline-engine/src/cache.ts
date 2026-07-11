import type { DataBatch, PipelineNode, PipelineProject } from '@luke/contracts';

interface CacheEntry {
  fingerprint: string;
  batch: DataBatch;
}

export class PipelineCache {
  readonly #entries = new Map<string, CacheEntry>();

  get(nodeId: string, fingerprint: string): DataBatch | undefined {
    const entry = this.#entries.get(nodeId);
    return entry?.fingerprint === fingerprint ? entry.batch : undefined;
  }

  set(nodeId: string, fingerprint: string, batch: DataBatch): void {
    this.#entries.set(nodeId, { fingerprint, batch });
  }

  invalidateDownstream(
    project: PipelineProject,
    changedNodeIds: string[],
  ): string[] {
    const adjacency = new Map<string, string[]>();
    for (const edge of project.edges) {
      const targets = adjacency.get(edge.source.nodeId) ?? [];
      targets.push(edge.target.nodeId);
      adjacency.set(edge.source.nodeId, targets);
    }
    const invalidated = new Set<string>();
    const pending = [...changedNodeIds];
    while (pending.length > 0) {
      const nodeId = pending.pop()!;
      if (invalidated.has(nodeId)) continue;
      invalidated.add(nodeId);
      pending.push(...(adjacency.get(nodeId) ?? []));
    }
    for (const nodeId of invalidated) this.#entries.delete(nodeId);
    return [...invalidated];
  }

  clear(): void {
    this.#entries.clear();
  }
}

export function nodeFingerprint(
  node: PipelineNode,
  upstreamFingerprints: string[],
): string {
  return canonicalStringify({
    kind: node.kind,
    config: node.config,
    upstream: upstreamFingerprints,
  });
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
