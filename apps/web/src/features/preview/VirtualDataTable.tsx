import type { DataBatch } from '@luke/contracts';
import { useMemo, useState } from 'react';

const rowHeight = 32;
const visibleRowCount = 8;
const overscan = 3;
const emptyRows: DataBatch['rows'] = [];
const emptyColumns: DataBatch['schema']['columns'] = [];

export function VirtualDataTable({ batch }: { batch?: DataBatch | undefined }) {
  const [scrollTop, setScrollTop] = useState(0);
  const rows = batch?.rows ?? emptyRows;
  const columns = batch?.schema.columns ?? emptyColumns;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rows.length, start + visibleRowCount + overscan * 2);
  const visibleRows = useMemo(() => rows.slice(start, end), [end, rows, start]);
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(140px, 1fr))`,
    minWidth: `${Math.max(1, columns.length) * 140}px`,
  };

  return (
    <div
      aria-label="数据表格"
      aria-rowcount={rows.length}
      className="virtual-table"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="table"
    >
      <div className="virtual-table__header" role="row" style={gridStyle}>
        {columns.map((column) => (
          <div key={column.id} role="columnheader">
            {column.name}
          </div>
        ))}
      </div>
      <div
        className="virtual-table__body"
        style={{ height: `${rows.length * rowHeight}px`, ...gridStyle }}
      >
        {visibleRows.map((row, visibleIndex) => {
          const rowIndex = start + visibleIndex;
          return (
            <div
              aria-rowindex={rowIndex + 1}
              className="virtual-table__row"
              key={rowIndex}
              role="row"
              style={{
                ...gridStyle,
                transform: `translateY(${rowIndex * rowHeight}px)`,
              }}
            >
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} role="cell">
                  {cell === null ? 'null' : String(cell)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
