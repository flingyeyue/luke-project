import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import { Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useRef, type DragEvent } from 'react';

import '@xyflow/react/dist/style.css';
import './canvas.css';

import { type CanvasNode, useCanvasStore } from './canvas-store';

const dragMime = 'application/x-luke-node-kind';

const nodeTemplates = [
  {
    kind: 'input.csv',
    label: 'CSV 输入',
    config: {
      sourceId: 'source',
      delimiter: 'auto',
      header: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
    },
  },
  {
    kind: 'transform.select',
    label: '选择与重命名',
    config: {
      columns: [{ sourceColumnId: 'column-1', outputName: 'Column' }],
    },
  },
  {
    kind: 'transform.cast',
    label: '类型转换',
    config: {
      rules: [
        {
          columnId: 'column-1',
          targetType: 'string',
          onError: 'fail',
        },
      ],
    },
  },
  {
    kind: 'transform.filter',
    label: '筛选',
    config: { predicate: { type: 'literal', value: true } },
  },
  {
    kind: 'transform.derive',
    label: '计算字段',
    config: {
      outputName: 'Calculated',
      expression: { type: 'literal', value: null },
    },
  },
  {
    kind: 'transform.sort',
    label: '排序',
    config: {
      rules: [{ columnId: 'column-1', direction: 'asc', nulls: 'last' }],
    },
  },
  {
    kind: 'transform.deduplicate',
    label: '去重',
    config: { columnIds: ['column-1'], keep: 'first' },
  },
  {
    kind: 'aggregate.group',
    label: '分组统计',
    config: {
      groupBy: [],
      aggregates: [{ operation: 'count', outputName: 'Count' }],
    },
  },
  {
    kind: 'output.csv',
    label: 'CSV 输出',
    config: { delimiter: ',', includeHeader: true, fileName: 'output.csv' },
  },
  {
    kind: 'output.json',
    label: 'JSON 输出',
    config: {
      shape: 'array-of-objects',
      pretty: true,
      fileName: 'output.json',
    },
  },
] as const;

function DataNode({ data, selected }: NodeProps<CanvasNode>) {
  const isInput = data.kind.startsWith('input.');
  const isOutput = data.kind.startsWith('output.');

  return (
    <div
      className={`data-node status-${data.status ?? 'idle'}${selected ? ' is-selected' : ''}`}
    >
      {!isInput && <Handle id="in" type="target" position={Position.Left} />}
      <span className="data-node__kind">{data.kind}</span>
      <strong>{data.label}</strong>
      {data.status && data.status !== 'idle' && (
        <span className="data-node__status">{statusLabel[data.status]}</span>
      )}
      {!isOutput && <Handle id="out" type="source" position={Position.Right} />}
    </div>
  );
}

const nodeTypes = { dataNode: DataNode };
const statusLabel = {
  idle: '空闲',
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  warning: '警告',
  failed: '失败',
  cancelled: '已取消',
} as const;

function CanvasSurface() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const pastCount = useCanvasStore((state) => state.past.length);
  const futureCount = useCanvasStore((state) => state.future.length);
  const connectionIssue = useCanvasStore((state) => state.connectionIssue);
  const applyNodeChanges = useCanvasStore((state) => state.applyNodeChanges);
  const applyEdgeChanges = useCanvasStore((state) => state.applyEdgeChanges);
  const connect = useCanvasStore((state) => state.connect);
  const addNode = useCanvasStore((state) => state.addNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const { fitView, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow();

  const addTemplate = useCallback(
    (
      template: (typeof nodeTemplates)[number],
      position: { x: number; y: number },
    ) => {
      const nodeId = crypto.randomUUID();
      const previousTerminal = [...nodes]
        .reverse()
        .find(
          (node) =>
            !edges.some((edge) => edge.source === node.id) &&
            !node.data.kind.startsWith('output.'),
        );
      addNode({
        id: nodeId,
        type: 'dataNode',
        position,
        data: {
          kind: template.kind,
          label: template.label,
          config: structuredClone(template.config),
        },
      });
      if (previousTerminal && !template.kind.startsWith('input.')) {
        useCanvasStore.getState().connect({
          source: previousTerminal.id,
          sourceHandle: 'out',
          target: nodeId,
          targetHandle: 'in',
        });
      }
    },
    [addNode, edges, nodes],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(dragMime);
      const template = nodeTemplates.find((item) => item.kind === kind);
      if (!template) return;

      addTemplate(
        template,
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
    },
    [addTemplate, screenToFlowPosition],
  );

  return (
    <section className="canvas-workspace" aria-label="流水线设计器">
      <aside className="canvas-library" aria-label="节点库">
        <h2>节点</h2>
        {nodeTemplates.map((template) => (
          <button
            className="node-template"
            draggable
            key={template.kind}
            onClick={() =>
              addTemplate(template, {
                x: 120 + nodes.length * 190,
                y: 120,
              })
            }
            onDragStart={(event) => {
              event.dataTransfer.setData(dragMime, template.kind);
              event.dataTransfer.effectAllowed = 'move';
            }}
            type="button"
          >
            <span>{template.label}</span>
            <small>{template.kind}</small>
          </button>
        ))}
      </aside>
      <div className="canvas-stage" ref={wrapperRef}>
        <div className="canvas-toolbar" role="toolbar" aria-label="画布工具">
          <button
            disabled={pastCount === 0}
            onClick={undo}
            title="撤销"
            type="button"
          >
            <Undo2 aria-hidden="true" size={17} />
          </button>
          <button
            disabled={futureCount === 0}
            onClick={redo}
            title="重做"
            type="button"
          >
            <Redo2 aria-hidden="true" size={17} />
          </button>
          <span />
          <button onClick={() => void zoomOut()} title="缩小" type="button">
            <ZoomOut aria-hidden="true" size={17} />
          </button>
          <button onClick={() => void zoomIn()} title="放大" type="button">
            <ZoomIn aria-hidden="true" size={17} />
          </button>
          <button onClick={() => void fitView()} title="适配视图" type="button">
            <Maximize2 aria-hidden="true" size={17} />
          </button>
        </div>
        <ReactFlow
          deleteKeyCode={['Backspace', 'Delete']}
          edges={edges}
          fitView
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={connect}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={onDrop}
          onEdgesChange={applyEdgeChanges}
          onNodesChange={applyNodeChanges}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="#c9d0ca"
            gap={20}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
        {connectionIssue && (
          <div className="connection-issue" role="alert">
            {connectionIssue}
          </div>
        )}
      </div>
    </section>
  );
}

export function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasSurface />
    </ReactFlowProvider>
  );
}
