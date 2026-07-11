import type { DataBatch, Diagnostic, WorkerEvent } from '@luke/contracts';
import { useMemo, useState } from 'react';

import './data-panel.css';

type Tab = 'data' | 'schema' | 'logs' | 'errors';
const emptyRows: DataBatch['rows'] = [];

interface DataPanelProps {
  batch?: DataBatch | undefined;
  diagnostics?: Diagnostic[];
  events?: WorkerEvent[];
}

const pageSize = 20;

export function DataPanel({
  batch,
  diagnostics = [],
  events = [],
}: DataPanelProps) {
  const [tab, setTab] = useState<Tab>('data');
  const [page, setPage] = useState(0);
  const rows = batch?.rows ?? emptyRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = useMemo(
    () => rows.slice(page * pageSize, (page + 1) * pageSize),
    [page, rows],
  );
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
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {batch?.schema.columns.map((column) => (
                      <th key={column.id}>{column.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, rowIndex) => (
                    <tr key={page * pageSize + rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>
                          {cell === null ? 'null' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <span>{batch?.totalRows ?? rows.length} 行</span>
              <div>
                <button
                  aria-label="上一页"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  type="button"
                >
                  ‹
                </button>
                <span>
                  {page + 1} / {pageCount}
                </span>
                <button
                  aria-label="下一页"
                  disabled={page + 1 >= pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  type="button"
                >
                  ›
                </button>
              </div>
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
