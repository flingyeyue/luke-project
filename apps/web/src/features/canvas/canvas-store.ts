import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import {
  nodeDefinitions,
  type NodeKind,
  type NodeRunStatus,
} from '@luke/contracts';
import { create } from 'zustand';

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
  config: unknown;
  status?: NodeRunStatus;
}

export type CanvasNode = Node<CanvasNodeData>;

export interface CanvasSnapshot {
  nodes: CanvasNode[];
  edges: Edge[];
}

interface CanvasState extends CanvasSnapshot {
  dirty: boolean;
  connectionIssue: string | null;
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  applyNodeChanges: (changes: NodeChange<CanvasNode>[]) => void;
  applyEdgeChanges: (changes: EdgeChange<Edge>[]) => void;
  connect: (connection: Connection) => void;
  addNode: (node: CanvasNode) => void;
  updateNodeConfig: (nodeId: string, config: unknown) => void;
  setNodeStatus: (nodeId: string, status: NodeRunStatus) => void;
  loadSnapshot: (snapshot: CanvasSnapshot) => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const initialSnapshot: CanvasSnapshot = { nodes: [], edges: [] };

const commit = (
  state: CanvasState,
  snapshot: CanvasSnapshot,
): Pick<CanvasState, 'nodes' | 'edges' | 'past' | 'future' | 'dirty'> => ({
  ...snapshot,
  past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-50),
  future: [],
  dirty: true,
});

export const useCanvasStore = create<CanvasState>((set) => ({
  ...initialSnapshot,
  past: [],
  future: [],
  connectionIssue: null,
  dirty: false,
  applyNodeChanges: (changes) =>
    set((state) => {
      const snapshot = {
        nodes: applyNodeChanges(changes, state.nodes),
        edges: state.edges,
      };
      return changes.every((change) =>
        ['select', 'dimensions'].includes(change.type),
      )
        ? snapshot
        : commit(state, snapshot);
    }),
  applyEdgeChanges: (changes) =>
    set((state) =>
      commit(state, {
        nodes: state.nodes,
        edges: applyEdgeChanges(changes, state.edges),
      }),
    ),
  connect: (connection) =>
    set((state) => {
      const issue = connectionIssue(state, connection);
      if (issue) return { connectionIssue: issue };
      return {
        ...commit(state, {
          nodes: state.nodes,
          edges: addEdge(
            {
              ...connection,
              sourceHandle: connection.sourceHandle ?? 'out',
              targetHandle: connection.targetHandle ?? 'in',
            },
            state.edges,
          ),
        }),
        connectionIssue: null,
      };
    }),
  addNode: (node) =>
    set((state) =>
      commit(state, {
        nodes: [
          ...state.nodes.map((item) => ({ ...item, selected: false })),
          { ...node, selected: true },
        ],
        edges: state.edges,
      }),
    ),
  updateNodeConfig: (nodeId, config) =>
    set((state) =>
      commit(state, {
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node,
        ),
        edges: state.edges,
      }),
    ),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, status } } : node,
      ),
    })),
  loadSnapshot: (snapshot) =>
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      past: [],
      future: [],
      dirty: false,
      connectionIssue: null,
    }),
  markSaved: () => set({ dirty: false }),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [
          { nodes: state.nodes, edges: state.edges },
          ...state.future,
        ].slice(0, 50),
        dirty: true,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...next,
        past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(
          -50,
        ),
        future: state.future.slice(1),
        dirty: true,
      };
    }),
  reset: () =>
    set({
      ...initialSnapshot,
      past: [],
      future: [],
      connectionIssue: null,
      dirty: false,
    }),
}));

function connectionIssue(
  state: CanvasState,
  connection: Connection,
): string | null {
  const source = state.nodes.find((node) => node.id === connection.source);
  const target = state.nodes.find((node) => node.id === connection.target);
  if (!source || !target) return '连接的节点不存在。';
  if (source.id === target.id) return '节点不能连接到自身。';

  const sourceDefinition = nodeDefinitions[source.data.kind as NodeKind];
  const targetDefinition = nodeDefinitions[target.data.kind as NodeKind];
  const sourcePort = connection.sourceHandle ?? 'out';
  const targetPort = connection.targetHandle ?? 'in';
  if (
    !sourceDefinition ||
    !(sourceDefinition.outputPorts as readonly string[]).includes(sourcePort)
  ) {
    return `无效输出端口：${sourcePort}`;
  }
  if (
    !targetDefinition ||
    !(targetDefinition.inputPorts as readonly string[]).includes(targetPort)
  ) {
    return `无效输入端口：${targetPort}`;
  }
  if (
    state.edges.some(
      (edge) =>
        edge.target === target.id && (edge.targetHandle ?? 'in') === targetPort,
    )
  ) {
    return `输入端口 ${targetPort} 已连接。`;
  }
  if (
    state.edges.some(
      (edge) => edge.source === source.id && edge.target === target.id,
    )
  ) {
    return '节点之间已存在连接。';
  }
  if (hasPath(state.edges, target.id, source.id)) {
    return '该连接会形成环。';
  }
  return null;
}

function hasPath(edges: Edge[], start: string, goal: string): boolean {
  const pending = [start];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === goal) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.source === current) pending.push(edge.target);
    }
  }
  return false;
}
