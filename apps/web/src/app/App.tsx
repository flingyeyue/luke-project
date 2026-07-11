import type { PipelineNode } from '@luke/contracts';

import { CanvasWorkspace } from '../features/canvas/CanvasWorkspace';
import { useCanvasStore } from '../features/canvas/canvas-store';
import { NodeConfigPanel } from '../features/node-config/NodeConfigPanel';
import { DataPanel } from '../features/preview/DataPanel';

export function App() {
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
        <span className="baseline-badge">Wave 1</span>
      </header>
      <div className="workspace-editor">
        <CanvasWorkspace />
        <NodeConfigPanel node={pipelineNode} onChange={updateNodeConfig} />
      </div>
      <DataPanel />
    </main>
  );
}
