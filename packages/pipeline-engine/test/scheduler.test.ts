import type { NodeRunResult, PipelineNode } from '@luke/contracts';
import { describe, expect, it, vi } from 'vitest';

import { runPipeline, type NodeExecutor } from '../src';
import { linearProject } from './fixtures';

const time = '2026-07-11T12:00:00.000Z';

const success = (nodeId: string): NodeRunResult => ({
  nodeId,
  status: 'succeeded',
  inputRows: 1,
  outputRows: 1,
  durationMs: 1,
  diagnostics: [],
});

describe('runPipeline', () => {
  it('executes nodes sequentially in graph order', async () => {
    const calls: string[] = [];
    const executor: NodeExecutor = {
      execute: vi.fn((node: PipelineNode): Promise<NodeRunResult> => {
        calls.push(node.id);
        return Promise.resolve(success(node.id));
      }),
    };

    const result = await runPipeline(linearProject, executor, {
      runId: 'run-1',
      signal: new AbortController().signal,
      clock: () => time,
    });

    expect(calls).toEqual(['input', 'filter', 'output']);
    expect(result.summary.status).toBe('succeeded');
  });

  it('stops after a failed node', async () => {
    const executor: NodeExecutor = {
      execute: vi.fn((node: PipelineNode): Promise<NodeRunResult> =>
        Promise.resolve({
          ...success(node.id),
          status: node.id === 'filter' ? 'failed' : 'succeeded',
        }),
      ),
    };

    const result = await runPipeline(linearProject, executor, {
      runId: 'run-1',
      signal: new AbortController().signal,
      clock: () => time,
    });

    expect(result.summary.nodeResults.map((item) => item.nodeId)).toEqual([
      'input',
      'filter',
    ]);
    expect(result.summary.status).toBe('failed');
  });

  it('does not execute when cancellation is already requested', async () => {
    const controller = new AbortController();
    controller.abort();
    const execute = vi.fn<NodeExecutor['execute']>();
    const executor: NodeExecutor = { execute };

    const result = await runPipeline(linearProject, executor, {
      runId: 'run-1',
      signal: controller.signal,
      clock: () => time,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.summary.status).toBe('cancelled');
  });

  it('does not execute invalid graphs', async () => {
    const project = structuredClone(linearProject);
    project.edges.push({
      id: 'cycle',
      source: { nodeId: 'filter', portId: 'out' },
      target: { nodeId: 'filter', portId: 'in' },
    });
    const execute = vi.fn<NodeExecutor['execute']>();
    const executor: NodeExecutor = { execute };

    const result = await runPipeline(project, executor, {
      runId: 'run-1',
      signal: new AbortController().signal,
      clock: () => time,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.summary.status).toBe('failed');
  });
});
