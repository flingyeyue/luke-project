import type { PipelineNode } from '@luke/contracts';
import { useState } from 'react';

import './node-config.css';

import { validateNodeConfig, type ConfigIssue } from './validation';

interface NodeConfigPanelProps {
  node: PipelineNode | null;
  onChange: (nodeId: string, config: unknown) => void;
}

export function NodeConfigPanel({ node, onChange }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <aside className="node-config-panel" aria-label="节点配置">
        <h2>配置</h2>
        <div className="empty-selection">未选择节点</div>
      </aside>
    );
  }

  return <NodeConfigEditor key={node.id} node={node} onChange={onChange} />;
}

function NodeConfigEditor({
  node,
  onChange,
}: {
  node: PipelineNode;
  onChange: NodeConfigPanelProps['onChange'];
}) {
  const [draft, setDraft] = useState(() =>
    JSON.stringify(node.config, null, 2),
  );
  const [issues, setIssues] = useState<ConfigIssue[]>([]);

  const validate = () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      const result = validateNodeConfig(node.kind, parsed);
      setIssues(result.issues);
      if (result.valid) onChange(node.id, result.value);
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
        <button onClick={validate} type="button">
          应用
        </button>
      </header>
      <label htmlFor="node-config-json">配置 JSON</label>
      <textarea
        aria-invalid={issues.length > 0}
        id="node-config-json"
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
        value={draft}
      />
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
