import type {
  DataBatch,
  Diagnostic,
  PipelineNode,
  WorkerEvent,
} from '@luke/contracts';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportCsv } from '@luke/file-adapters/export';

import { CanvasWorkspace } from '../features/canvas/CanvasWorkspace';
import { useCanvasStore } from '../features/canvas/canvas-store';
import { NodeConfigPanel } from '../features/node-config/NodeConfigPanel';
import { DataPanel } from '../features/preview/DataPanel';
import { ProjectControls } from '../features/project/ProjectControls';
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
        <ProjectControls />
        <CsvRunControls
          onBatchChange={setBatch}
          onDiagnosticsChange={setDiagnostics}
          onEventsChange={(next) =>
            setEvents((current) =>
              next.length === 0 ? [] : [...current, ...next],
            )
          }
        />
        <button
          className="export-command"
          disabled={!batch}
          onClick={() => {
            if (!batch) return;
            const exported = exportCsv(batch, {
              delimiter: ',',
              includeHeader: true,
              fileName: 'pipeline-output.csv',
            });
            const url = URL.createObjectURL(
              new Blob([exported.content], { type: exported.mimeType }),
            );
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = exported.fileName;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          title="导出 CSV"
          type="button"
        >
          <Download aria-hidden="true" size={16} />
          导出
        </button>
        <span className="baseline-badge">M1</span>
      </header>
      <div className="workspace-editor">
        <CanvasWorkspace />
        <NodeConfigPanel
          columns={batch?.schema.columns}
          node={pipelineNode}
          onChange={updateNodeConfig}
        />
      </div>
      <DataPanel batch={batch} diagnostics={diagnostics} events={events} />
    </main>
  );
}
