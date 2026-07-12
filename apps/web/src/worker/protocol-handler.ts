import {
  type DataBatch,
  type Diagnostic,
  type NodeConfigByKind,
  type PipelineNode,
  type NodeRunResult,
  type RunSummary,
  type WorkerEvent,
  workerCommandSchema,
} from '@luke/contracts';
import { parseCsvFile } from '@luke/file-adapters/csv';
import {
  executeJoin,
  executeTransformNode,
  validateGraph,
} from '@luke/pipeline-engine';

type Clock = () => string;

const diagnostic = (
  code: string,
  message: string,
  nodeId?: string,
): Diagnostic => ({ code, severity: 'error', message, nodeId });

export class ProtocolHandler {
  readonly #cancelledRuns = new Set<string>();
  readonly #previews = new Map<string, DataBatch>();
  readonly #clock: Clock;

  constructor(clock: Clock = () => new Date().toISOString()) {
    this.#clock = clock;
  }

  async handle(input: unknown): Promise<WorkerEvent[]> {
    const parsed = workerCommandSchema.safeParse(input);
    if (!parsed.success) return [];

    const command = parsed.data;
    switch (command.type) {
      case 'ping':
        return [{ type: 'pong', requestId: command.requestId }];
      case 'cancel':
        this.#cancelledRuns.add(command.runId);
        return [
          {
            type: 'run-cancelled',
            runId: command.runId,
            finishedAt: this.#clock(),
          },
        ];
      case 'preview': {
        const batch = this.#previews.get(`${command.runId}:${command.nodeId}`);
        if (!batch) {
          return [
            {
              type: 'run-failed',
              runId: command.runId,
              diagnostics: [
                diagnostic(
                  'PREVIEW_NOT_AVAILABLE',
                  'Run the input node before requesting a preview.',
                  command.nodeId,
                ),
              ],
            },
          ];
        }
        return [
          {
            type: 'preview-result',
            requestId: command.requestId,
            runId: command.runId,
            nodeId: command.nodeId,
            batch: {
              ...batch,
              rows: batch.rows.slice(
                command.offset,
                command.offset + command.limit,
              ),
              offset: command.offset,
              totalRows: batch.totalRows ?? batch.rows.length,
            },
          },
        ];
      }
      case 'run':
        return this.#runCsvInput(command);
    }
  }

  async #runCsvInput(
    command: Extract<
      ReturnType<typeof workerCommandSchema.parse>,
      { type: 'run' }
    >,
  ): Promise<WorkerEvent[]> {
    if (this.#cancelledRuns.has(command.runId)) {
      return [
        {
          type: 'run-cancelled',
          runId: command.runId,
          finishedAt: this.#clock(),
        },
      ];
    }

    const startedAt = this.#clock();
    if (command.project.nodes.length === 0) {
      return [
        { type: 'run-started', runId: command.runId, startedAt },
        {
          type: 'run-completed',
          runId: command.runId,
          summary: {
            runId: command.runId,
            status: 'succeeded',
            startedAt,
            finishedAt: this.#clock(),
            nodeResults: [],
          },
        },
      ];
    }

    const validation = validateGraph(command.project);
    const graphErrors = validation.diagnostics.filter(
      (item) => item.severity === 'error',
    );
    if (graphErrors.length > 0) {
      return [
        { type: 'run-started', runId: command.runId, startedAt },
        { type: 'run-failed', runId: command.runId, diagnostics: graphErrors },
      ];
    }
    const inputNodes = validation.order
      .map((nodeId) =>
        command.project.nodes.find((candidate) => candidate.id === nodeId),
      )
      .filter(
        (node): node is PipelineNode & { kind: 'input.csv' } =>
          node?.kind === 'input.csv',
      );
    if (inputNodes.length === 0) {
      return this.#failedRun(
        command.runId,
        startedAt,
        diagnostic('PIPELINE_EMPTY', 'The pipeline does not contain a node.'),
      );
    }
    const events: WorkerEvent[] = [
      { type: 'run-started', runId: command.runId, startedAt },
    ];
    const batches = new Map<string, DataBatch>();
    const nodeResults: NodeRunResult[] = [];

    for (const node of inputNodes) {
      const config = node.config as NodeConfigByKind['input.csv'];
      const source = command.sources.find(
        (candidate) => candidate.sourceId === config.sourceId,
      );
      if (!source) {
        const item = diagnostic(
          'SOURCE_NOT_FOUND',
          `Select a CSV file for source ${config.sourceId}.`,
          node.id,
        );
        return [
          ...events,
          { type: 'run-failed', runId: command.runId, diagnostics: [item] },
        ];
      }

      let parsed: Awaited<ReturnType<typeof parseCsvFile>>;
      try {
        parsed = await parseCsvFile(source.file, config);
      } catch (error) {
        const item = diagnostic(
          'SOURCE_READ_FAILED',
          error instanceof Error
            ? error.message
            : 'The CSV source could not be read.',
          node.id,
        );
        return [
          ...events,
          { type: 'run-failed', runId: command.runId, diagnostics: [item] },
        ];
      }
      if (this.#cancelledRuns.has(command.runId)) {
        return [
          ...events,
          {
            type: 'run-cancelled',
            runId: command.runId,
            finishedAt: this.#clock(),
          },
        ];
      }
      const diagnostics: Diagnostic[] = parsed.diagnostics.map((item) => ({
        ...item,
        nodeId: node.id,
      }));
      const hasErrors = diagnostics.some((item) => item.severity === 'error');
      const result: NodeRunResult = {
        nodeId: node.id,
        status: hasErrors
          ? 'failed'
          : diagnostics.length > 0
            ? 'warning'
            : 'succeeded',
        inputRows: parsed.batch.totalRows ?? parsed.batch.rows.length,
        outputRows: parsed.batch.totalRows ?? parsed.batch.rows.length,
        durationMs: 0,
        diagnostics,
      };
      events.push(
        {
          type: 'node-progress',
          runId: command.runId,
          nodeId: node.id,
          progress: 1,
          message: 'CSV parsed',
        },
        { type: 'node-result', runId: command.runId, result },
      );
      nodeResults.push(result);
      if (hasErrors) {
        return [
          ...events,
          { type: 'run-failed', runId: command.runId, diagnostics },
        ];
      }
      batches.set(node.id, parsed.batch);
      this.#previews.set(`${command.runId}:${node.id}`, parsed.batch);
    }

    for (const nodeId of validation.order) {
      if (inputNodes.some((node) => node.id === nodeId)) continue;
      const currentNode = command.project.nodes.find(
        (candidate) => candidate.id === nodeId,
      );
      if (!currentNode) continue;
      if (this.#cancelledRuns.has(command.runId)) {
        return [
          ...events,
          {
            type: 'run-cancelled',
            runId: command.runId,
            finishedAt: this.#clock(),
          },
        ];
      }
      const incoming = command.project.edges.filter(
        (edge) => edge.target.nodeId === nodeId,
      );
      const firstIncoming = incoming[0];
      const inputBatch = firstIncoming
        ? batches.get(firstIncoming.source.nodeId)
        : undefined;
      if (!inputBatch) {
        const item = diagnostic(
          'INPUT_DATA_NOT_AVAILABLE',
          'The upstream node did not produce data.',
          nodeId,
        );
        return [
          ...events,
          { type: 'run-failed', runId: command.runId, diagnostics: [item] },
        ];
      }

      const leftEdge = incoming.find((edge) => edge.target.portId === 'left');
      const rightEdge = incoming.find((edge) => edge.target.portId === 'right');
      const rightBatch = rightEdge
        ? batches.get(rightEdge.source.nodeId)
        : undefined;
      const transformed =
        currentNode.kind === 'combine.join' && leftEdge && rightBatch
          ? executeJoin(
              batches.get(leftEdge.source.nodeId) ?? inputBatch,
              rightBatch,
              currentNode.config as NodeConfigByKind['combine.join'],
              currentNode.id,
            )
          : currentNode.kind.startsWith('transform.') ||
              currentNode.kind === 'aggregate.group'
            ? executeTransformNode(currentNode, inputBatch)
            : { batch: inputBatch, diagnostics: [] };
      const failed = transformed.diagnostics.some(
        (item) => item.severity === 'error',
      );
      const currentResult: NodeRunResult = {
        nodeId,
        status: failed
          ? 'failed'
          : transformed.diagnostics.length > 0
            ? 'warning'
            : 'succeeded',
        inputRows: inputBatch.totalRows ?? inputBatch.rows.length,
        outputRows:
          transformed.batch.totalRows ?? transformed.batch.rows.length,
        durationMs: 0,
        diagnostics: transformed.diagnostics,
      };
      events.push(
        {
          type: 'node-progress',
          runId: command.runId,
          nodeId,
          progress: 1,
          message: 'Node completed',
        },
        { type: 'node-result', runId: command.runId, result: currentResult },
      );
      nodeResults.push(currentResult);
      if (failed) {
        return [
          ...events,
          {
            type: 'run-failed',
            runId: command.runId,
            diagnostics: transformed.diagnostics,
          },
        ];
      }
      batches.set(nodeId, transformed.batch);
      this.#previews.set(`${command.runId}:${nodeId}`, transformed.batch);
    }
    const summary: RunSummary = {
      runId: command.runId,
      status: nodeResults.some((item) => item.status === 'warning')
        ? 'warning'
        : 'succeeded',
      startedAt,
      finishedAt: this.#clock(),
      nodeResults,
    };
    return [
      ...events,
      { type: 'run-completed', runId: command.runId, summary },
    ];
  }

  #failedRun(
    runId: string,
    startedAt: string,
    item: Diagnostic,
  ): WorkerEvent[] {
    return [
      { type: 'run-started', runId, startedAt },
      { type: 'run-failed', runId, diagnostics: [item] },
    ];
  }
}
