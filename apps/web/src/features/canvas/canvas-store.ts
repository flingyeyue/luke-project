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
import { create } from 'zustand';

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
}

export type CanvasNode = Node<CanvasNodeData>;

interface Snapshot {
  nodes: CanvasNode[];
  edges: Edge[];
}

interface CanvasState extends Snapshot {
  past: Snapshot[];
  future: Snapshot[];
  applyNodeChanges: (changes: NodeChange<CanvasNode>[]) => void;
  applyEdgeChanges: (changes: EdgeChange<Edge>[]) => void;
  connect: (connection: Connection) => void;
  addNode: (node: CanvasNode) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const initialSnapshot: Snapshot = { nodes: [], edges: [] };

const commit = (
  state: CanvasState,
  snapshot: Snapshot,
): Pick<CanvasState, 'nodes' | 'edges' | 'past' | 'future'> => ({
  ...snapshot,
  past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-50),
  future: [],
});

export const useCanvasStore = create<CanvasState>((set) => ({
  ...initialSnapshot,
  past: [],
  future: [],
  applyNodeChanges: (changes) =>
    set((state) =>
      commit(state, {
        nodes: applyNodeChanges(changes, state.nodes),
        edges: state.edges,
      }),
    ),
  applyEdgeChanges: (changes) =>
    set((state) =>
      commit(state, {
        nodes: state.nodes,
        edges: applyEdgeChanges(changes, state.edges),
      }),
    ),
  connect: (connection) =>
    set((state) =>
      commit(state, {
        nodes: state.nodes,
        edges: addEdge(connection, state.edges),
      }),
    ),
  addNode: (node) =>
    set((state) =>
      commit(state, { nodes: [...state.nodes, node], edges: state.edges }),
    ),
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
      };
    }),
  reset: () => set({ ...initialSnapshot, past: [], future: [] }),
}));
