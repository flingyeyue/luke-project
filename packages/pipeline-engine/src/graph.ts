import {
  type Diagnostic,
  type PipelineEdge,
  type PipelineProject,
  nodeDefinitions,
} from '@luke/contracts';

export interface GraphValidationResult {
  diagnostics: Diagnostic[];
  order: string[];
}

const diagnostic = (
  code: string,
  message: string,
  nodeId?: string,
): Diagnostic => ({
  code,
  severity: 'error',
  message,
  ...(nodeId ? { nodeId } : {}),
});

const adjacencyFor = (
  project: PipelineProject,
  validEdges: PipelineEdge[],
): Map<string, string[]> => {
  const adjacency = new Map<string, string[]>(
    project.nodes.map((node) => [node.id, []]),
  );
  for (const edge of validEdges) {
    adjacency.get(edge.source.nodeId)?.push(edge.target.nodeId);
  }
  return adjacency;
};

export function validateGraph(project: PipelineProject): GraphValidationResult {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const validEdges: PipelineEdge[] = [];
  const occupiedInputs = new Set<string>();

  for (const edge of project.edges) {
    const source = nodes.get(edge.source.nodeId);
    const target = nodes.get(edge.target.nodeId);
    if (!source || !target) {
      diagnostics.push(
        diagnostic(
          'EDGE_REFERENCE_INVALID',
          `Edge ${edge.id} references a missing node.`,
        ),
      );
      continue;
    }

    const sourceDefinition = nodeDefinitions[source.kind];
    const targetDefinition = nodeDefinitions[target.kind];
    if (
      !sourceDefinition.outputPorts.some(
        (portId) => portId === edge.source.portId,
      ) ||
      !targetDefinition.inputPorts.some(
        (portId) => portId === edge.target.portId,
      )
    ) {
      diagnostics.push(
        diagnostic(
          'PORT_CONNECTION_INVALID',
          `Edge ${edge.id} uses an invalid port.`,
          target.id,
        ),
      );
      continue;
    }

    const inputKey = `${edge.target.nodeId}:${edge.target.portId}`;
    if (occupiedInputs.has(inputKey)) {
      diagnostics.push(
        diagnostic(
          'PORT_CONNECTION_INVALID',
          `Input ${inputKey} has more than one connection.`,
          target.id,
        ),
      );
      continue;
    }
    occupiedInputs.add(inputKey);
    validEdges.push(edge);
  }

  const adjacency = adjacencyFor(project, validEdges);
  const indegree = new Map(project.nodes.map((node) => [node.id, 0]));
  for (const edge of validEdges) {
    indegree.set(
      edge.target.nodeId,
      (indegree.get(edge.target.nodeId) ?? 0) + 1,
    );
  }

  const queue = project.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  const order: string[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index];
    if (!nodeId) continue;
    order.push(nodeId);
    for (const targetId of adjacency.get(nodeId) ?? []) {
      const next = (indegree.get(targetId) ?? 1) - 1;
      indegree.set(targetId, next);
      if (next === 0) queue.push(targetId);
    }
  }

  if (order.length !== project.nodes.length) {
    diagnostics.push(
      diagnostic(
        'GRAPH_CYCLE_DETECTED',
        'The pipeline graph contains a cycle.',
      ),
    );
  }

  const reachable = new Set<string>();
  const frontier = project.nodes
    .filter((node) => node.kind.startsWith('input.'))
    .map((node) => node.id);
  for (let index = 0; index < frontier.length; index += 1) {
    const nodeId = frontier[index];
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    frontier.push(...(adjacency.get(nodeId) ?? []));
  }

  for (const node of project.nodes) {
    if (!reachable.has(node.id)) {
      diagnostics.push(
        diagnostic(
          'GRAPH_NODE_UNREACHABLE',
          `Node ${node.label} is not reachable from an input.`,
          node.id,
        ),
      );
    }
  }

  return { diagnostics, order };
}
