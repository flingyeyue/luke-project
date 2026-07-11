import {
  dataBatchSchema,
  nodeConfigSchemaByKind,
  nodeDefinitions,
  nodeKindSchema,
  pipelineProjectSchema,
  workerCommandSchema,
  workerEventSchema,
} from '../src';
import { describe, expect, it } from 'vitest';
import { validProject } from './fixtures';

describe('pipelineProjectSchema', () => {
  it('round-trips a valid project through JSON', () => {
    const serialized = JSON.stringify(validProject);
    const result = pipelineProjectSchema.parse(JSON.parse(serialized));

    expect(result).toEqual(validProject);
  });

  it('rejects unsupported project versions', () => {
    const result = pipelineProjectSchema.safeParse({
      ...validProject,
      formatVersion: 2,
    });

    expect(result.success).toBe(false);
  });

  it('validates node configuration by node kind', () => {
    const invalid = structuredClone(validProject);
    invalid.nodes[0]!.config = { sourceId: '' };

    const result = pipelineProjectSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});

describe('node registry', () => {
  it('has definitions and schemas for every node kind', () => {
    for (const kind of nodeKindSchema.options) {
      expect(nodeDefinitions[kind]).toBeDefined();
      expect(nodeConfigSchemaByKind[kind]).toBeDefined();
    }
  });

  it('uses the required join ports', () => {
    expect(nodeDefinitions['combine.join'].inputPorts).toEqual([
      'left',
      'right',
    ]);
  });
});

describe('dataBatchSchema', () => {
  it('rejects rows that do not match the schema width', () => {
    const result = dataBatchSchema.safeParse({
      schema: {
        columns: [
          { id: 'name', name: 'Name', type: 'string', nullable: false },
        ],
      },
      rows: [['Ada', 42]],
      offset: 0,
    });

    expect(result.success).toBe(false);
  });
});

describe('worker protocol', () => {
  it('accepts ping and cancel commands', () => {
    expect(
      workerCommandSchema.parse({ type: 'ping', requestId: 'request-1' }),
    ).toEqual({ type: 'ping', requestId: 'request-1' });
    expect(
      workerCommandSchema.parse({ type: 'cancel', runId: 'run-1' }),
    ).toEqual({ type: 'cancel', runId: 'run-1' });
  });

  it('rejects progress outside zero to one', () => {
    const result = workerEventSchema.safeParse({
      type: 'node-progress',
      runId: 'run-1',
      nodeId: 'node-1',
      progress: 2,
    });

    expect(result.success).toBe(false);
  });

  it('rejects previews larger than the contract limit', () => {
    const result = workerCommandSchema.safeParse({
      type: 'preview',
      requestId: 'request-1',
      runId: 'run-1',
      nodeId: 'node-1',
      offset: 0,
      limit: 1001,
    });

    expect(result.success).toBe(false);
  });
});
