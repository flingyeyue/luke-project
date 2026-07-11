import { describe, expect, it } from 'vitest';

import { validateGraph } from '../src';
import { linearProject } from './fixtures';

describe('validateGraph', () => {
  it('returns a stable topological order', () => {
    const result = validateGraph(linearProject);

    expect(result.diagnostics).toEqual([]);
    expect(result.order).toEqual(['input', 'filter', 'output']);
  });

  it('rejects missing node references', () => {
    const project = structuredClone(linearProject);
    project.edges[0]!.source.nodeId = 'missing';

    expect(validateGraph(project).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'EDGE_REFERENCE_INVALID' }),
    );
  });

  it('rejects invalid ports and duplicate target inputs', () => {
    const invalidPort = structuredClone(linearProject);
    invalidPort.edges[0]!.target.portId = 'left';
    expect(validateGraph(invalidPort).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PORT_CONNECTION_INVALID' }),
    );

    const duplicate = structuredClone(linearProject);
    duplicate.edges.push({
      id: 'edge-3',
      source: { nodeId: 'input', portId: 'out' },
      target: { nodeId: 'filter', portId: 'in' },
    });
    expect(validateGraph(duplicate).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PORT_CONNECTION_INVALID' }),
    );
  });

  it('detects cycles', () => {
    const project = structuredClone(linearProject);
    project.edges = [
      {
        id: 'edge-cycle',
        source: { nodeId: 'filter', portId: 'out' },
        target: { nodeId: 'filter', portId: 'in' },
      },
    ];

    expect(validateGraph(project).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'GRAPH_CYCLE_DETECTED' }),
    );
  });

  it('detects nodes unreachable from an input', () => {
    const project = structuredClone(linearProject);
    project.edges = [];

    expect(validateGraph(project).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'GRAPH_NODE_UNREACHABLE',
        nodeId: 'filter',
      }),
    );
  });
});
