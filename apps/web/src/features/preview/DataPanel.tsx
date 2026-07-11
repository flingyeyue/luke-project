import type { DataBatch, Diagnostic, WorkerEvent } from '@luke/contracts';
import { useState } from 'react';

import './data-panel.css';

import { VirtualDataTable } from './VirtualDataTable';

type Tab = 'data' | 'schema' | 'logs' | 'errors';

interface DataPanelProps {
  batch?: DataBatch | undefined;
  diagnostics?: Diagnostic[];
  events?: WorkerEvent[];
}

export function DataPanel({
  batch,
  diagnostics = [],
  events = [],
}: DataPanelProps) {
  const [tab, setTab] = useState<Tab>('data');
  const errors = diagnostics.filter((item) => item.severity === 'error');

  return (
    <section className="runtime-panel" aria-label="运行数据">
      <nav aria-label="运行数据视图">
        {(
          [
            ['data', '数据'],
            ['schema', '字段'],
            ['logs', `日志 ${events.length}`],
            ['errors', `错误 ${errors.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-selected={tab === value}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="runtime-panel__content">
        {tab === 'data' && (
          <>
            <VirtualDataTable batch={batch} />
            <footer>
              <span>{batch?.totalRows ?? batch?.rows.length ?? 0} 行</span>
              <span>已加载 {batch?.rows.length ?? 0} 行</span>
            </footer>
          </>
        )}
        {tab === 'schema' && (
          <ul className="schema-list">
            {batch?.schema.columns.map((column) => (
              <li key={column.id}>
                <strong>{column.name}</strong>
                <code>{column.type}</code>
                <span>{column.nullable ? '可空' : '必填'}</span>
              </li>
            ))}
          </ul>
        )}
        {tab === 'logs' && (
          <ol className="event-list">
            {events.map((event, index) => (
              <li key={`${event.type}-${index}`}>{event.type}</li>
            ))}
          </ol>
        )}
        {tab === 'errors' && (
          <ul className="error-list">
            {errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                <code>{error.code}</code>
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
