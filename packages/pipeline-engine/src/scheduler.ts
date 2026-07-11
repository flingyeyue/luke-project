import {
  type Diagnostic,
  type NodeRunResult,
  type PipelineNode,
  type PipelineProject,
  type RunSummary,
} from '@luke/contracts';

import { validateGraph } from './graph';

export interface NodeExecutor {
  execute(node: PipelineNode, signal: AbortSignal): Promise<NodeRunResult>;
}

export interface RunOptions {
  runId: string;
  signal: AbortSignal;
  clock?: () => string;
}

export interface EngineRunResult {
  summary: RunSummary;
  diagnostics: Diagnostic[];
}

const cancelledResult = (nodeId: string): NodeRunResult => ({
  nodeId,
  status: 'cancelled',
  inputRows: 0,
  outputRows: 0,
  durationMs: 0,
  diagnostics: [
    {
      code: 'RUN_CANCELLED',
      severity: 'warning',
      message: 'The pipeline run was cancelled.',
      nodeId,
    },
  ],
});

export async function runPipeline(
  project: PipelineProject,
  executor: NodeExecutor,
  options: RunOptions,
): Promise<EngineRunResult> {
  const clock = options.clock ?? (() => new Date().toISOString());
  const startedAt = clock();
  const validation = validateGraph(project);
  const validationErrors = validation.diagnostics.filter(
    (item) => item.severity === 'error',
  );
  if (validationErrors.length > 0) {
    return {
      diagnostics: validation.diagnostics,
      summary: {
        runId: options.runId,
        status: 'failed',
        startedAt,
        finishedAt: clock(),
        nodeResults: [],
      },
    };
  }

  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const nodeResults: NodeRunResult[] = [];
  for (const nodeId of validation.order) {
    const node = nodes.get(nodeId);
    if (!node) continue;
    if (options.signal.aborted) {
      nodeResults.push(cancelledResult(nodeId));
      break;
    }

    const result = await executor.execute(node, options.signal);
    nodeResults.push(result);
    if (result.status === 'failed' || result.status === 'cancelled') break;
  }

  const status = nodeResults.some((result) => result.status === 'failed')
    ? 'failed'
    : nodeResults.some((result) => result.status === 'cancelled')
      ? 'cancelled'
      : nodeResults.some((result) => result.status === 'warning')
        ? 'warning'
        : 'succeeded';

  return {
    diagnostics: [
      ...validation.diagnostics,
      ...nodeResults.flatMap((result) => result.diagnostics),
    ],
    summary: {
      runId: options.runId,
      status,
      startedAt,
      finishedAt: clock(),
      nodeResults,
    },
  };
}
