import {
  type DataBatch,
  type Diagnostic,
  type NodeConfigByKind,
  type PipelineProject,
  type SourceBinding,
  type WorkerCommand,
  type WorkerEvent,
  workerEventSchema,
} from '@luke/contracts';
import { FileUp, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useCanvasStore } from '../canvas/canvas-store';
import { createId } from '../../shared/create-id';
import { createPipelineWorker } from '../../worker/create-pipeline-worker';

interface CsvRunControlsProps {
  onBatchChange: (batch: DataBatch | undefined) => void;
  onDiagnosticsChange: (diagnostics: Diagnostic[]) => void;
  onEventsChange: (events: WorkerEvent[]) => void;
  selectedNodeId: string | undefined;
}

interface ActiveRun {
  runId: string;
  defaultPreviewNodeId: string;
  completionStatus: string;
  completed: boolean;
  availableNodeIds: Set<string>;
}

export function CsvRunControls({
  onBatchChange,
  onDiagnosticsChange,
  onEventsChange,
  selectedNodeId,
}: CsvRunControlsProps) {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const addNode = useCanvasStore((state) => state.addNode);
  const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);
  const setNodeStatus = useCanvasStore((state) => state.setNodeStatus);
  const workerRef = useRef<Worker | undefined>(undefined);
  const runRef = useRef<ActiveRun | undefined>(undefined);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const [sources, setSources] = useState<SourceBinding[]>([]);
  const [status, setStatus] = useState('等待文件');

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

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
      if (
        'runId' in event &&
        runRef.current &&
        event.runId !== runRef.current.runId
      ) {
        return;
      }
      onEventsChange([event]);
      if (event.type === 'run-started') {
        setStatus('解析中');
        if (runRef.current) {
          setNodeStatus(runRef.current.defaultPreviewNodeId, 'running');
        }
      }
      if (event.type === 'node-result') {
        onDiagnosticsChange(event.result.diagnostics);
        setNodeStatus(event.result.nodeId, event.result.status);
      }
      if (event.type === 'run-failed') {
        setStatus('运行失败');
        onDiagnosticsChange(event.diagnostics);
        if (runRef.current) {
          setNodeStatus(runRef.current.defaultPreviewNodeId, 'failed');
        }
      }
      if (event.type === 'run-completed' && runRef.current) {
        const activeRun = runRef.current;
        activeRun.completed = true;
        activeRun.availableNodeIds = new Set(
          event.summary.nodeResults.map((result) => result.nodeId),
        );
        setStatus(
          event.summary.status === 'warning'
            ? `${activeRun.completionStatus}，有警告`
            : activeRun.completionStatus,
        );
        const selectedNode = selectedNodeIdRef.current;
        const previewNodeId =
          selectedNode && activeRun.availableNodeIds.has(selectedNode)
            ? selectedNode
            : activeRun.defaultPreviewNodeId;
        postPreview(worker, activeRun.runId, previewNodeId);
      }
      if (
        event.type === 'preview-result' &&
        (!selectedNodeIdRef.current ||
          event.nodeId === selectedNodeIdRef.current)
      ) {
        onBatchChange(event.batch);
      }
    });
    workerRef.current = worker;
    return worker;
  };

  useEffect(() => {
    if (!selectedNodeId) {
      onBatchChange(undefined);
      return;
    }
    const activeRun = runRef.current;
    const worker = workerRef.current;
    if (!activeRun?.completed || !worker) return;
    if (!activeRun.availableNodeIds.has(selectedNodeId)) {
      onBatchChange(undefined);
      return;
    }
    postPreview(worker, activeRun.runId, selectedNodeId);
  }, [onBatchChange, selectedNodeId]);

  const startRun = (
    project: PipelineProject,
    runSources: SourceBinding[],
    defaultPreviewNodeId: string,
    completionStatus: string,
  ) => {
    const runId = createId();
    runRef.current = {
      runId,
      defaultPreviewNodeId,
      completionStatus,
      completed: false,
      availableNodeIds: new Set(),
    };
    ensureWorker().postMessage({
      type: 'run',
      runId,
      project,
      sources: runSources,
    } satisfies WorkerCommand);
  };

  const selectFile = (file: File) => {
    const boundSourceIds = new Set(sources.map((item) => item.sourceId));
    const existing = nodes.find(
      (node) =>
        node.data.kind === 'input.csv' &&
        !boundSourceIds.has(
          (node.data.config as NodeConfigByKind['input.csv']).sourceId,
        ),
    );
    const nodeId = existing?.id ?? createId();
    const sourceId = `source-${nodeId}`;
    const config: NodeConfigByKind['input.csv'] = existing
      ? {
          ...(existing.data.config as NodeConfigByKind['input.csv']),
          sourceId,
        }
      : {
          sourceId,
          delimiter: 'auto',
          header: true,
          encoding: 'utf-8',
          skipEmptyLines: true,
        };
    if (existing) {
      updateNodeConfig(nodeId, {
        ...config,
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
          config,
        },
      });
    }
    const binding: SourceBinding = {
      sourceId,
      displayName: file.name,
      file,
      size: file.size,
      lastModified: file.lastModified,
    };
    setSources((current) => [
      ...current.filter((item) => item.sourceId !== sourceId),
      binding,
    ]);
    setStatus(`${file.name} · ${file.size} B`);
    onBatchChange(undefined);
    onDiagnosticsChange([]);
    setNodeStatus(nodeId, 'queued');
    const now = new Date().toISOString();
    startRun(
      {
        format: 'visual-data-pipeline',
        formatVersion: 1,
        id: `source-preview-${nodeId}`,
        name: `${file.name} 预览`,
        createdAt: now,
        updatedAt: now,
        nodes: [
          {
            id: nodeId,
            kind: 'input.csv',
            label: file.name,
            position: existing?.position ?? { x: 120, y: 120 },
            config,
          },
        ],
        edges: [],
      },
      [binding],
      nodeId,
      `${file.name} · ${file.size} B`,
    );
  };

  const run = () => {
    if (sources.length === 0) return;
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
    const outgoing = new Set(project.edges.map((edge) => edge.source.nodeId));
    const previewNode =
      [...project.nodes].reverse().find((node) => !outgoing.has(node.id)) ??
      csvNode;
    for (const node of project.nodes) setNodeStatus(node.id, 'queued');
    onEventsChange([]);
    onDiagnosticsChange([]);
    onBatchChange(undefined);
    setStatus('排队中');
    startRun(project, sources, previewNode.id, '完成');
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
      <button disabled={sources.length === 0} onClick={run} type="button">
        <Play aria-hidden="true" size={15} />
        运行
      </button>
      <output>{status}</output>
    </div>
  );
}

function postPreview(worker: Worker, runId: string, nodeId: string) {
  worker.postMessage({
    type: 'preview',
    requestId: createId(),
    runId,
    nodeId,
    offset: 0,
    limit: 1000,
  } satisfies WorkerCommand);
}
