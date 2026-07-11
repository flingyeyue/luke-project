import type {
  DataBatch,
  Diagnostic,
  PipelineNode,
  WorkerEvent,
} from '@luke/contracts';
import { useState } from 'react';

import { CanvasWorkspace } from '../features/canvas/CanvasWorkspace';
import { useCanvasStore } from '../features/canvas/canvas-store';
import { NodeConfigPanel } from '../features/node-config/NodeConfigPanel';
import { DataPanel } from '../features/preview/DataPanel';
import { CsvRunControls } from '../features/run/CsvRunControls';

export function App() {
  const [batch, setBatch] = useState<DataBatch>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [events, setEvents] = useState<WorkerEvent[]>([]);
  const selectedNode = useCanvasStore((state) =>
    state.nodes.find((node) => node.selected),
  );
  const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);
  const pipelineNode: PipelineNode | null = selectedNode
    ? {
        id: selectedNode.id,
        kind: selectedNode.data.kind as PipelineNode['kind'],
        label: selectedNode.data.label,
        position: selectedNode.position,
        config: selectedNode.data.config,
      }
    : null;

  return (
    <main className="workspace-shell">
      <header className="command-bar">
        <strong>数据流水线</strong>
        <CsvRunControls
          onBatchChange={setBatch}
          onDiagnosticsChange={setDiagnostics}
          onEventsChange={(next) =>
            setEvents((current) =>
              next.length === 0 ? [] : [...current, ...next],
            )
          }
        />
        <span className="baseline-badge">M1</span>
      </header>
      <div className="workspace-editor">
        <CanvasWorkspace />
        <NodeConfigPanel node={pipelineNode} onChange={updateNodeConfig} />
      </div>
      <DataPanel batch={batch} diagnostics={diagnostics} events={events} />
    </main>
  );
}
