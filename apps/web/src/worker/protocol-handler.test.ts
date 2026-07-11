import { workerEventSchema } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { ProtocolHandler } from './protocol-handler';

const fixedTime = '2026-07-11T12:00:00.000Z';

describe('ProtocolHandler', () => {
  it('answers ping with pong', () => {
    const handler = new ProtocolHandler(() => fixedTime);

    const events = handler.handle({ type: 'ping', requestId: 'request-1' });

    expect(events).toEqual([{ type: 'pong', requestId: 'request-1' }]);
    expect(workerEventSchema.parse(events[0])).toBeDefined();
  });

  it('completes an empty pipeline run', () => {
    const handler = new ProtocolHandler(() => fixedTime);

    const events = handler.handle({
      type: 'run',
      runId: 'run-1',
      project: {
        format: 'visual-data-pipeline',
        formatVersion: 1,
        id: 'project-1',
        name: 'Empty pipeline',
        createdAt: fixedTime,
        updatedAt: fixedTime,
        nodes: [],
        edges: [],
      },
      sources: [],
    });

    expect(events.map((event) => event.type)).toEqual([
      'run-started',
      'run-completed',
    ]);
    events.forEach((event) =>
      expect(workerEventSchema.parse(event)).toEqual(event),
    );
  });

  it('cancels a run idempotently', () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const command = { type: 'cancel', runId: 'run-1' } as const;

    expect(handler.handle(command)).toEqual(handler.handle(command));
  });

  it('does not start a run after it has been cancelled', () => {
    const handler = new ProtocolHandler(() => fixedTime);
    handler.handle({ type: 'cancel', runId: 'run-1' });

    const events = handler.handle({
      type: 'run',
      runId: 'run-1',
      project: {
        format: 'visual-data-pipeline',
        formatVersion: 1,
        id: 'project-1',
        name: 'Cancelled pipeline',
        createdAt: fixedTime,
        updatedAt: fixedTime,
        nodes: [],
        edges: [],
      },
      sources: [],
    });

    expect(events).toEqual([
      { type: 'run-cancelled', runId: 'run-1', finishedAt: fixedTime },
    ]);
  });

  it('rejects malformed messages without emitting invalid events', () => {
    const handler = new ProtocolHandler(() => fixedTime);

    expect(handler.handle({ type: 'preview', limit: 1001 })).toEqual([]);
  });
});
