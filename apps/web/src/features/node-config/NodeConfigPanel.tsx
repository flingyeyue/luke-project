import type { DataColumn, PipelineNode } from '@luke/contracts';
import { useState } from 'react';

import './node-config.css';

import { validateNodeConfig, type ConfigIssue } from './validation';
import { VisualConfigEditor } from './VisualConfigEditor';

interface NodeConfigPanelProps {
  columns?: DataColumn[] | undefined;
  node: PipelineNode | null;
  onChange: (nodeId: string, config: unknown) => void;
}

export function NodeConfigPanel({
  columns = [],
  node,
  onChange,
}: NodeConfigPanelProps) {
  if (!node) {
    return (
      <aside className="node-config-panel" aria-label="节点配置">
        <h2>配置</h2>
        <div className="empty-selection">未选择节点</div>
      </aside>
    );
  }

  return (
    <NodeConfigEditor
      columns={columns}
      key={node.id}
      node={node}
      onChange={onChange}
    />
  );
}

function NodeConfigEditor({
  node,
  onChange,
  columns,
}: {
  columns: DataColumn[];
  node: PipelineNode;
  onChange: NodeConfigPanelProps['onChange'];
}) {
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [visualDraft, setVisualDraft] = useState<unknown>(() =>
    structuredClone(node.config),
  );
  const [jsonDraft, setJsonDraft] = useState(() =>
    JSON.stringify(node.config, null, 2),
  );
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [applied, setApplied] = useState(false);

  const apply = () => {
    try {
      const candidate =
        mode === 'json' ? (JSON.parse(jsonDraft) as unknown) : visualDraft;
      const result = validateNodeConfig(node.kind, candidate);
      setIssues(result.issues);
      setApplied(result.valid);
      if (result.valid) {
        setVisualDraft(result.value);
        setJsonDraft(JSON.stringify(result.value, null, 2));
        onChange(node.id, result.value);
      }
    } catch (error) {
      setApplied(false);
      setIssues([
        {
          path: 'config',
          message:
            error instanceof Error ? error.message : '配置不是有效 JSON。',
        },
      ]);
    }
  };

  const selectMode = (nextMode: 'visual' | 'json') => {
    if (nextMode === mode) return;
    if (nextMode === 'json') {
      setJsonDraft(JSON.stringify(visualDraft, null, 2));
      setIssues([]);
      setMode('json');
      return;
    }

    try {
      const parsed = JSON.parse(jsonDraft) as unknown;
      const result = validateNodeConfig(node.kind, parsed);
      setIssues(result.issues);
      if (!result.valid) return;
      setVisualDraft(result.value);
      setMode('visual');
    } catch (error) {
      setIssues([
        {
          path: 'config',
          message:
            error instanceof Error ? error.message : '配置不是有效 JSON。',
        },
      ]);
    }
  };

  return (
    <aside className="node-config-panel" aria-label="节点配置">
      <header>
        <div>
          <h2>{node.label}</h2>
          <span>{node.kind}</span>
        </div>
        <button onClick={apply} type="button">
          应用
        </button>
      </header>
      <div className="config-mode-switch" aria-label="配置模式" role="group">
        <button
          aria-pressed={mode === 'visual'}
          onClick={() => selectMode('visual')}
          type="button"
        >
          可视化
        </button>
        <button
          aria-pressed={mode === 'json'}
          onClick={() => selectMode('json')}
          type="button"
        >
          JSON
        </button>
      </div>
      <div className="config-editor-body">
        {mode === 'visual' ? (
          <VisualConfigEditor
            columns={columns}
            kind={node.kind}
            onChange={(nextValue) => {
              setVisualDraft(nextValue);
              setApplied(false);
              setIssues([]);
            }}
            value={visualDraft}
          />
        ) : (
          <label className="json-config-field" htmlFor="node-config-json">
            配置 JSON
            <textarea
              aria-invalid={issues.length > 0}
              id="node-config-json"
              onChange={(event) => {
                setJsonDraft(event.target.value);
                setApplied(false);
              }}
              spellCheck={false}
              value={jsonDraft}
            />
          </label>
        )}
      </div>
      <div className="config-status" role="status">
        {applied ? '配置已应用' : '编辑后应用以验证配置'}
      </div>
      {issues.length > 0 && (
        <ul className="config-issues" aria-label="配置错误">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code>{issue.path}</code>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
