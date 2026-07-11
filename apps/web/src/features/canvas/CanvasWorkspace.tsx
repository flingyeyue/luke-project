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

import {
  type CanvasNode,
  type CanvasNodeData,
  useCanvasStore,
} from './canvas-store';

const dragMime = 'application/x-luke-node-kind';

const nodeTemplates = [
  { kind: 'input.csv', label: 'CSV 输入' },
  { kind: 'transform.filter', label: '筛选' },
  { kind: 'output.csv', label: 'CSV 输出' },
] as const;

function DataNode({ data, selected }: NodeProps<CanvasNode>) {
  const isInput = data.kind.startsWith('input.');
  const isOutput = data.kind.startsWith('output.');

  return (
    <div className={`data-node${selected ? ' is-selected' : ''}`}>
      {!isInput && <Handle type="target" position={Position.Left} />}
      <span className="data-node__kind">{data.kind}</span>
      <strong>{data.label}</strong>
      {!isOutput && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

const nodeTypes = { dataNode: DataNode };

function CanvasSurface() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const pastCount = useCanvasStore((state) => state.past.length);
  const futureCount = useCanvasStore((state) => state.future.length);
  const applyNodeChanges = useCanvasStore((state) => state.applyNodeChanges);
  const applyEdgeChanges = useCanvasStore((state) => state.applyEdgeChanges);
  const connect = useCanvasStore((state) => state.connect);
  const addNode = useCanvasStore((state) => state.addNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const { fitView, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow();

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(dragMime);
      const template = nodeTemplates.find((item) => item.kind === kind);
      if (!template) return;

      const data: CanvasNodeData = { kind, label: template.label };
      addNode({
        id: crypto.randomUUID(),
        type: 'dataNode',
        position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        data,
      });
    },
    [addNode, screenToFlowPosition],
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
