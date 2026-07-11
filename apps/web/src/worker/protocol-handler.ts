import {
  type DataBatch,
  type Diagnostic,
  type NodeConfigByKind,
  type NodeRunResult,
  type RunSummary,
  type WorkerEvent,
  workerCommandSchema,
} from '@luke/contracts';
import { parseCsvFile } from '@luke/file-adapters';

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

    const node =
      command.project.nodes.find(
        (candidate) => candidate.id === command.targetNodeId,
      ) ?? command.project.nodes[0];
    if (!node) {
      return this.#failedRun(
        command.runId,
        startedAt,
        diagnostic('PIPELINE_EMPTY', 'The pipeline does not contain a node.'),
      );
    }
    if (node.kind !== 'input.csv') {
      return this.#failedRun(
        command.runId,
        startedAt,
        diagnostic(
          'NODE_KIND_NOT_IMPLEMENTED',
          `Wave 1 execution supports CSV input nodes, not ${node.kind}.`,
          node.id,
        ),
      );
    }

    const config = node.config as NodeConfigByKind['input.csv'];
    const source = command.sources.find(
      (candidate) => candidate.sourceId === config.sourceId,
    );
    if (!source) {
      return this.#failedRun(
        command.runId,
        startedAt,
        diagnostic(
          'SOURCE_NOT_FOUND',
          `Select a CSV file for source ${config.sourceId}.`,
          node.id,
        ),
      );
    }

    let parsed: Awaited<ReturnType<typeof parseCsvFile>>;
    try {
      parsed = await parseCsvFile(source.file, config);
    } catch (error) {
      return this.#failedRun(
        command.runId,
        startedAt,
        diagnostic(
          'SOURCE_READ_FAILED',
          error instanceof Error
            ? error.message
            : 'The CSV source could not be read.',
          node.id,
        ),
      );
    }
    if (this.#cancelledRuns.has(command.runId)) {
      return [
        {
          type: 'run-cancelled',
          runId: command.runId,
          finishedAt: this.#clock(),
        },
      ];
    }
    const diagnostics = parsed.diagnostics.map((item) => ({
      ...item,
      nodeId: node.id,
    }));
    const hasErrors = diagnostics.some((item) => item.severity === 'error');
    const status = hasErrors
      ? 'failed'
      : diagnostics.length > 0
        ? 'warning'
        : 'succeeded';
    const result: NodeRunResult = {
      nodeId: node.id,
      status,
      inputRows: parsed.batch.totalRows ?? parsed.batch.rows.length,
      outputRows: parsed.batch.totalRows ?? parsed.batch.rows.length,
      durationMs: 0,
      diagnostics,
    };
    const events: WorkerEvent[] = [
      { type: 'run-started', runId: command.runId, startedAt },
      {
        type: 'node-progress',
        runId: command.runId,
        nodeId: node.id,
        progress: 1,
        message: 'CSV parsed',
      },
      { type: 'node-result', runId: command.runId, result },
    ];

    if (hasErrors) {
      return [
        ...events,
        { type: 'run-failed', runId: command.runId, diagnostics },
      ];
    }

    this.#previews.set(`${command.runId}:${node.id}`, parsed.batch);
    const summary: RunSummary = {
      runId: command.runId,
      status,
      startedAt,
      finishedAt: this.#clock(),
      nodeResults: [result],
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
