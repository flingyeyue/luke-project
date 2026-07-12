import type { PipelineProject } from '@luke/contracts';
import { FilePlus2, FolderOpen, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  openProjectFile,
  openProjectText,
  saveProjectFile,
} from '@luke/file-adapters/project';

import { useCanvasStore } from '../canvas/canvas-store';

const draftKey = 'luke-pipeline-draft-v1';

export function ProjectControls() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const dirty = useCanvasStore((state) => state.dirty);
  const reset = useCanvasStore((state) => state.reset);
  const loadSnapshot = useCanvasStore((state) => state.loadSnapshot);
  const markSaved = useCanvasStore((state) => state.markSaved);
  const [hasDraft, setHasDraft] = useState(
    () => localStorage.getItem(draftKey) !== null,
  );

  useEffect(() => {
    if (!dirty) return;
    localStorage.setItem(draftKey, JSON.stringify(buildProject(nodes, edges)));
  }, [dirty, edges, nodes]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!useCanvasStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);

  const mayDiscard = () =>
    !dirty || window.confirm('当前项目有未保存修改，确定继续吗？');

  const load = (project: PipelineProject) => {
    loadSnapshot({
      nodes: project.nodes.map((node) => ({
        id: node.id,
        type: 'dataNode',
        position: node.position,
        data: { kind: node.kind, label: node.label, config: node.config },
      })),
      edges: project.edges.map((edge) => ({
        id: edge.id,
        source: edge.source.nodeId,
        sourceHandle: edge.source.portId,
        target: edge.target.nodeId,
        targetHandle: edge.target.portId,
      })),
    });
  };

  return (
    <div className="project-controls" aria-label="项目文件">
      <button
        onClick={() => {
          if (!mayDiscard()) return;
          reset();
        }}
        title="新建项目"
        type="button"
      >
        <FilePlus2 aria-hidden="true" size={16} />
      </button>
      <label title="打开项目">
        <FolderOpen aria-hidden="true" size={16} />
        <input
          accept=".json,.vdp.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !mayDiscard()) return;
            void openProjectFile(file).then((result) => {
              if (result.project) load(result.project);
            });
            event.target.value = '';
          }}
          type="file"
        />
      </label>
      <button
        disabled={nodes.length === 0}
        onClick={() => {
          const exported = saveProjectFile(buildProject(nodes, edges));
          download(exported.content, exported.mimeType, exported.fileName);
          markSaved();
          localStorage.removeItem(draftKey);
          setHasDraft(false);
        }}
        title="保存项目"
        type="button"
      >
        <Save aria-hidden="true" size={16} />
      </button>
      {hasDraft && (
        <button
          onClick={() => {
            if (!mayDiscard()) return;
            const text = localStorage.getItem(draftKey);
            if (!text) return;
            const result = openProjectText(text);
            if (result.project) load(result.project);
          }}
          title="恢复草稿"
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
        </button>
      )}
      <span>{dirty ? '未保存' : '已保存'}</span>
    </div>
  );
}

function buildProject(
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes'],
  edges: ReturnType<typeof useCanvasStore.getState>['edges'],
): PipelineProject {
  const now = new Date().toISOString();
  return {
    format: 'visual-data-pipeline',
    formatVersion: 1,
    id: 'active-project',
    name: 'Pipeline',
    createdAt: now,
    updatedAt: now,
    nodes: nodes.map((node) => ({
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
}

function download(content: string, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
