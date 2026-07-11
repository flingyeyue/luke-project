import { fireEvent, render, screen } from '@testing-library/react';
import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { DataPanel } from './DataPanel';

const batch: DataBatch = {
  schema: {
    columns: [{ id: 'name', name: 'Name', type: 'string', nullable: false }],
  },
  rows: Array.from({ length: 21 }, (_, index) => [`Row ${index + 1}`]),
  offset: 0,
  totalRows: 21,
};

describe('DataPanel', () => {
  it('paginates preview rows', () => {
    render(<DataPanel batch={batch} />);

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('下一页'));
    expect(screen.getByText('Row 21')).toBeInTheDocument();
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
