import {
  type Diagnostic,
  type RunSummary,
  type WorkerEvent,
  workerCommandSchema,
} from '@luke/contracts';

type Clock = () => string;

const protocolDiagnostic = (message: string): Diagnostic => ({
  code: 'INTERNAL_EXECUTION_ERROR',
  severity: 'error',
  message,
});

export class ProtocolHandler {
  readonly #cancelledRuns = new Set<string>();
  readonly #clock: Clock;

  constructor(clock: Clock = () => new Date().toISOString()) {
    this.#clock = clock;
  }

  handle(input: unknown): WorkerEvent[] {
    const parsed = workerCommandSchema.safeParse(input);
    if (!parsed.success) {
      return [];
    }

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
      case 'run': {
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
        if (command.project.nodes.length > 0) {
          return [
            { type: 'run-started', runId: command.runId, startedAt },
            {
              type: 'run-failed',
              runId: command.runId,
              diagnostics: [
                protocolDiagnostic(
                  'The execution engine is not available in the M0 baseline.',
                ),
              ],
            },
          ];
        }

        const finishedAt = this.#clock();
        const summary: RunSummary = {
          runId: command.runId,
          status: 'succeeded',
          startedAt,
          finishedAt,
          nodeResults: [],
        };
        return [
          { type: 'run-started', runId: command.runId, startedAt },
          { type: 'run-completed', runId: command.runId, summary },
        ];
      }
      case 'preview':
        return [
          {
            type: 'run-failed',
            runId: command.runId,
            diagnostics: [
              protocolDiagnostic(
                'Preview is unavailable until a pipeline has executed.',
              ),
            ],
          },
        ];
    }
  }
}
