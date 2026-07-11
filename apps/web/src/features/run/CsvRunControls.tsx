import {
  type DataBatch,
  type Diagnostic,
  type PipelineProject,
  type SourceBinding,
  type WorkerCommand,
  type WorkerEvent,
  workerEventSchema,
} from '@luke/contracts';
import { FileUp, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useCanvasStore } from '../canvas/canvas-store';
import { createPipelineWorker } from '../../worker/create-pipeline-worker';

interface CsvRunControlsProps {
  onBatchChange: (batch: DataBatch | undefined) => void;
  onDiagnosticsChange: (diagnostics: Diagnostic[]) => void;
  onEventsChange: (events: WorkerEvent[]) => void;
}

export function CsvRunControls({
  onBatchChange,
  onDiagnosticsChange,
  onEventsChange,
}: CsvRunControlsProps) {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const addNode = useCanvasStore((state) => state.addNode);
  const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);
  const setNodeStatus = useCanvasStore((state) => state.setNodeStatus);
  const workerRef = useRef<Worker | undefined>(undefined);
  const runRef = useRef<{ runId: string; nodeId: string } | undefined>(
    undefined,
  );
  const [source, setSource] = useState<SourceBinding>();
  const [status, setStatus] = useState('等待文件');

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  const ensureWorker = () => {
    if (workerRef.current) return workerRef.current;
    const worker = createPipelineWorker();
    worker.addEventListener('message', (message: MessageEvent<unknown>) => {
      const parsed = workerEventSchema.safeParse(message.data);
      if (!parsed.success) return;
      const event = parsed.data;
      onEventsChange([event]);
      if (event.type === 'run-started') {
        setStatus('解析中');
        if (runRef.current) setNodeStatus(runRef.current.nodeId, 'running');
      }
      if (event.type === 'node-result') {
        onDiagnosticsChange(event.result.diagnostics);
        setNodeStatus(event.result.nodeId, event.result.status);
      }
      if (event.type === 'run-failed') {
        setStatus('运行失败');
        onDiagnosticsChange(event.diagnostics);
        if (runRef.current) setNodeStatus(runRef.current.nodeId, 'failed');
      }
      if (event.type === 'run-completed' && runRef.current) {
        setStatus(event.summary.status === 'warning' ? '完成，有警告' : '完成');
        worker.postMessage({
          type: 'preview',
          requestId: crypto.randomUUID(),
          runId: runRef.current.runId,
          nodeId: runRef.current.nodeId,
          offset: 0,
          limit: 1000,
        } satisfies WorkerCommand);
      }
      if (event.type === 'preview-result') onBatchChange(event.batch);
    });
    workerRef.current = worker;
    return worker;
  };

  const selectFile = (file: File) => {
    const existing = nodes.find((node) => node.data.kind === 'input.csv');
    const nodeId = existing?.id ?? crypto.randomUUID();
    const sourceId = `source-${nodeId}`;
    if (existing) {
      updateNodeConfig(nodeId, {
        ...(existing.data.config as Record<string, unknown>),
        sourceId,
      });
    } else {
      addNode({
        id: nodeId,
        type: 'dataNode',
        position: { x: 120, y: 120 },
        selected: true,
        data: {
          kind: 'input.csv',
          label: file.name,
          config: {
            sourceId,
            delimiter: 'auto',
            header: true,
            encoding: 'utf-8',
            skipEmptyLines: true,
          },
        },
      });
    }
    setSource({
      sourceId,
      displayName: file.name,
      file,
      size: file.size,
      lastModified: file.lastModified,
    });
    setStatus(`${file.name} · ${file.size} B`);
    onBatchChange(undefined);
    onDiagnosticsChange([]);
  };

  const run = () => {
    if (!source) return;
    const csvNode = useCanvasStore
      .getState()
      .nodes.find((node) => node.data.kind === 'input.csv');
    if (!csvNode) return;
    const now = new Date().toISOString();
    const project: PipelineProject = {
      format: 'visual-data-pipeline',
      formatVersion: 1,
      id: 'active-project',
      name: '当前流水线',
      createdAt: now,
      updatedAt: now,
      nodes: useCanvasStore.getState().nodes.map((node) => ({
        id: node.id,
        kind: node.data.kind as PipelineProject['nodes'][number]['kind'],
        label: node.data.label,
        position: node.position,
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: { nodeId: edge.source, portId: edge.sourceHandle ?? 'out' },
        target: { nodeId: edge.target, portId: edge.targetHandle ?? 'in' },
      })),
    };
    const runId = crypto.randomUUID();
    runRef.current = { runId, nodeId: csvNode.id };
    setNodeStatus(csvNode.id, 'queued');
    onEventsChange([]);
    onDiagnosticsChange([]);
    onBatchChange(undefined);
    setStatus('排队中');
    ensureWorker().postMessage({
      type: 'run',
      runId,
      project,
      sources: [source],
      targetNodeId: csvNode.id,
    } satisfies WorkerCommand);
  };

  return (
    <div className="run-controls">
      <label className="file-command">
        <FileUp aria-hidden="true" size={16} />
        <span>选择 CSV</span>
        <input
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) selectFile(file);
          }}
          type="file"
        />
      </label>
      <button disabled={!source} onClick={run} type="button">
        <Play aria-hidden="true" size={15} />
        运行
      </button>
      <output>{status}</output>
    </div>
  );
}
