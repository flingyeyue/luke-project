import { workerEventSchema } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { ProtocolHandler } from './protocol-handler';

const fixedTime = '2026-07-11T12:00:00.000Z';
const csvNode = {
  id: 'csv-1',
  kind: 'input.csv' as const,
  label: 'Orders',
  position: { x: 0, y: 0 },
  config: {
    sourceId: 'orders',
    delimiter: 'auto' as const,
    header: true,
    encoding: 'utf-8' as const,
    skipEmptyLines: true,
  },
};
const project = (nodes: (typeof csvNode)[] = []) => ({
  format: 'visual-data-pipeline' as const,
  formatVersion: 1 as const,
  id: 'project-1',
  name: 'Pipeline',
  createdAt: fixedTime,
  updatedAt: fixedTime,
  nodes,
  edges: [],
});

describe('ProtocolHandler', () => {
  it('answers ping with pong', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const events = await handler.handle({
      type: 'ping',
      requestId: 'request-1',
    });

    expect(events).toEqual([{ type: 'pong', requestId: 'request-1' }]);
    expect(workerEventSchema.parse(events[0])).toBeDefined();
  });

  it('parses a bound CSV and serves a paged preview', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const file = new File(['region,total\nNorth,12\nSouth,8'], 'orders.csv');
    const events = await handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project([csvNode]),
      sources: [
        {
          sourceId: 'orders',
          displayName: file.name,
          file,
          size: file.size,
          lastModified: file.lastModified,
        },
      ],
    });

    expect(events.map((event) => event.type)).toEqual([
      'run-started',
      'node-progress',
      'node-result',
      'run-completed',
    ]);
    const preview = await handler.handle({
      type: 'preview',
      requestId: 'preview-1',
      runId: 'run-1',
      nodeId: 'csv-1',
      offset: 1,
      limit: 1,
    });
    expect(preview[0]).toMatchObject({
      type: 'preview-result',
      batch: { rows: [['South', 8]], offset: 1, totalRows: 2 },
    });
    [...events, ...preview].forEach((event) =>
      expect(workerEventSchema.parse(event)).toEqual(event),
    );
  });

  it('joins two independently bound CSV inputs by explicit ports', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const rightNode = {
      ...csvNode,
      id: 'csv-2',
      label: 'Regions',
      config: { ...csvNode.config, sourceId: 'regions' },
    };
    const joinNode = {
      id: 'join-1',
      kind: 'combine.join' as const,
      label: 'Orders with regions',
      position: { x: 200, y: 0 },
      config: {
        joinType: 'inner' as const,
        leftKeys: ['region-2'],
        rightKeys: ['region-1'],
        rightColumnPrefix: 'region.',
      },
    };
    const orders = new File(
      ['order_id,region,total\nORD-1,North,12\nORD-2,South,8'],
      'orders.csv',
    );
    const regions = new File(
      ['region,manager\nNorth,Ada\nWest,Lin'],
      'regions.csv',
    );
    const events = await handler.handle({
      type: 'run',
      runId: 'run-join',
      project: {
        ...project(),
        nodes: [csvNode, rightNode, joinNode],
        edges: [
          {
            id: 'left',
            source: { nodeId: 'csv-1', portId: 'out' },
            target: { nodeId: 'join-1', portId: 'left' },
          },
          {
            id: 'right',
            source: { nodeId: 'csv-2', portId: 'out' },
            target: { nodeId: 'join-1', portId: 'right' },
          },
        ],
      },
      sources: [binding('orders', orders), binding('regions', regions)],
    });

    expect(events.at(-1)).toMatchObject({
      type: 'run-completed',
      summary: { status: 'succeeded' },
    });
    const preview = await handler.handle({
      type: 'preview',
      requestId: 'preview-join',
      runId: 'run-join',
      nodeId: 'join-1',
      offset: 0,
      limit: 10,
    });
    expect(preview[0]).toMatchObject({
      type: 'preview-result',
      batch: {
        rows: [['ORD-1', 'North', 12, 'North', 'Ada']],
        totalRows: 1,
      },
    });
  });

  it('reports a missing source on the input node', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const events = await handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project([csvNode]),
      sources: [],
    });

    expect(events.at(-1)).toMatchObject({
      type: 'run-failed',
      diagnostics: [{ code: 'SOURCE_NOT_FOUND', nodeId: 'csv-1' }],
    });
  });

  it('turns file read failures into node diagnostics', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const file = new File(['unused'], 'broken.csv');
    file.text = () => Promise.reject(new Error('File read failed.'));
    const events = await handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project([csvNode]),
      sources: [
        {
          sourceId: 'orders',
          displayName: file.name,
          file,
          size: file.size,
          lastModified: file.lastModified,
        },
      ],
    });

    expect(events.at(-1)).toMatchObject({
      type: 'run-failed',
      diagnostics: [{ code: 'SOURCE_READ_FAILED', nodeId: 'csv-1' }],
    });
  });

  it('completes an empty pipeline run', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const events = await handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project(),
      sources: [],
    });

    expect(events.map((event) => event.type)).toEqual([
      'run-started',
      'run-completed',
    ]);
  });

  it('cancels a run idempotently', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    const command = { type: 'cancel', runId: 'run-1' } as const;

    expect(await handler.handle(command)).toEqual(
      await handler.handle(command),
    );
  });

  it('does not start a run after it has been cancelled', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    await handler.handle({ type: 'cancel', runId: 'run-1' });
    const events = await handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project(),
      sources: [],
    });

    expect(events).toEqual([
      { type: 'run-cancelled', runId: 'run-1', finishedAt: fixedTime },
    ]);
  });

  it('stops after an in-flight source read is cancelled', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    let finishRead: ((text: string) => void) | undefined;
    const file = new File(['unused'], 'slow.csv');
    file.text = () =>
      new Promise<string>((resolve) => {
        finishRead = resolve;
      });
    const run = handler.handle({
      type: 'run',
      runId: 'run-1',
      project: project([csvNode]),
      sources: [
        {
          sourceId: 'orders',
          displayName: file.name,
          file,
          size: file.size,
          lastModified: file.lastModified,
        },
      ],
    });

    expect(await handler.handle({ type: 'cancel', runId: 'run-1' })).toEqual([
      { type: 'run-cancelled', runId: 'run-1', finishedAt: fixedTime },
    ]);
    finishRead?.('region,total\nNorth,12');
    expect(await run).toEqual([
      { type: 'run-started', runId: 'run-1', startedAt: fixedTime },
      { type: 'run-cancelled', runId: 'run-1', finishedAt: fixedTime },
    ]);
  });

  it('rejects malformed messages without emitting invalid events', async () => {
    const handler = new ProtocolHandler(() => fixedTime);
    expect(await handler.handle({ type: 'preview', limit: 1001 })).toEqual([]);
  });
});

function binding(sourceId: string, file: File) {
  return {
    sourceId,
    displayName: file.name,
    file,
    size: file.size,
    lastModified: file.lastModified,
  };
}
