import { beforeEach, describe, expect, it } from 'vitest';

import { useCanvasStore } from './canvas-store';

const node = {
  id: 'node-1',
  type: 'dataNode',
  position: { x: 0, y: 0 },
  data: {
    kind: 'input.csv',
    label: 'CSV 输入',
    config: { sourceId: 'source' },
  },
};

describe('canvas store', () => {
  beforeEach(() => useCanvasStore.getState().reset());

  it('adds and removes a node through React Flow changes', () => {
    useCanvasStore.getState().addNode(node);
    expect(useCanvasStore.getState().nodes).toHaveLength(1);

    useCanvasStore
      .getState()
      .applyNodeChanges([{ id: node.id, type: 'remove' }]);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it('undoes and redoes committed changes', () => {
    useCanvasStore.getState().addNode(node);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes).toEqual([node]);
  });

  it('connects nodes and clears future history after a new change', () => {
    useCanvasStore.getState().addNode(node);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().future).toHaveLength(1);

    useCanvasStore.getState().addNode({ ...node, id: 'node-2' });
    expect(useCanvasStore.getState().future).toHaveLength(0);
  });

  it('accepts valid ports and rejects occupied inputs', () => {
    useCanvasStore.getState().addNode(node);
    useCanvasStore.getState().addNode({
      ...node,
      id: 'filter-1',
      data: {
        kind: 'transform.filter',
        label: 'Filter',
        config: { predicate: { type: 'literal', value: true } },
      },
    });
    useCanvasStore.getState().addNode({ ...node, id: 'source-2' });

    useCanvasStore.getState().connect({
      source: 'node-1',
      sourceHandle: 'out',
      target: 'filter-1',
      targetHandle: 'in',
    });
    expect(useCanvasStore.getState().edges).toHaveLength(1);

    useCanvasStore.getState().connect({
      source: 'source-2',
      sourceHandle: 'out',
      target: 'filter-1',
      targetHandle: 'in',
    });
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    expect(useCanvasStore.getState().connectionIssue).toMatch(/已连接/u);
  });

  it('rejects invalid ports, self connections, and cycles', () => {
    const transform = {
      ...node,
      data: {
        kind: 'transform.filter',
        label: 'Filter',
        config: { predicate: { type: 'literal', value: true } },
      },
    };
    useCanvasStore.getState().addNode({ ...transform, id: 'a' });
    useCanvasStore.getState().addNode({ ...transform, id: 'b' });

    useCanvasStore.getState().connect({
      source: 'a',
      sourceHandle: 'missing',
      target: 'b',
      targetHandle: 'in',
    });
    expect(useCanvasStore.getState().connectionIssue).toMatch(/无效输出端口/u);

    useCanvasStore.getState().connect({
      source: 'a',
      sourceHandle: 'out',
      target: 'a',
      targetHandle: 'in',
    });
    expect(useCanvasStore.getState().connectionIssue).toMatch(/自身/u);

    useCanvasStore.getState().connect({
      source: 'a',
      sourceHandle: 'out',
      target: 'b',
      targetHandle: 'in',
    });
    useCanvasStore.getState().connect({
      source: 'b',
      sourceHandle: 'out',
      target: 'a',
      targetHandle: 'in',
    });
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    expect(useCanvasStore.getState().connectionIssue).toMatch(/形成环/u);
  });

  it('updates runtime status without adding undo history', () => {
    useCanvasStore.getState().addNode(node);
    const historyLength = useCanvasStore.getState().past.length;

    useCanvasStore.getState().setNodeStatus(node.id, 'running');

    expect(useCanvasStore.getState().nodes[0]?.data.status).toBe('running');
    expect(useCanvasStore.getState().past).toHaveLength(historyLength);
  });

  it('updates node configuration as an undoable change', () => {
    useCanvasStore.getState().addNode(node);
    useCanvasStore.getState().updateNodeConfig(node.id, { sourceId: 'orders' });

    expect(useCanvasStore.getState().nodes[0]?.data.config).toEqual({
      sourceId: 'orders',
    });
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes[0]?.data.config).toEqual({
      sourceId: 'source',
    });
  });
});
