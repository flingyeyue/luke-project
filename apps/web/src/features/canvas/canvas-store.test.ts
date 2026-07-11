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
