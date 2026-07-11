import type { DataBatch } from '@luke/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataPanel } from './DataPanel';

const batch: DataBatch = {
  schema: {
    columns: [{ id: 'name', name: 'Name', type: 'string', nullable: false }],
  },
  rows: Array.from({ length: 1000 }, (_, index) => [`Row ${index + 1}`]),
  offset: 0,
  totalRows: 1000,
};

describe('DataPanel', () => {
  it('virtualizes a 1000-row preview while supporting direct scrolling', () => {
    render(<DataPanel batch={batch} />);

    const table = screen.getByRole('table', { name: '数据表格' });
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 1000')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeLessThan(20);

    fireEvent.scroll(table, { target: { scrollTop: 32 * 999 } });

    expect(screen.getByText('Row 1000')).toBeInTheDocument();
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
    expect(screen.getByText('1000 行')).toBeInTheDocument();
  });

  it('shows structured errors in the error tab', () => {
    render(
      <DataPanel
        diagnostics={[
          {
            code: 'SOURCE_PARSE_FAILED',
            severity: 'error',
            message: 'Invalid CSV.',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '错误 1' }));
    expect(screen.getByText('SOURCE_PARSE_FAILED')).toBeInTheDocument();
  });
});
