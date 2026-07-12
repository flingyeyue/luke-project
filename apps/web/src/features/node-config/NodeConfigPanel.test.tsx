import type { NodeKind, PipelineNode } from '@luke/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NodeConfigPanel } from './NodeConfigPanel';

const configs: Partial<Record<NodeKind, unknown>> = {
  'transform.select': {
    columns: [{ sourceColumnId: 'amount', outputName: 'Total' }],
  },
  'transform.cast': {
    rules: [{ columnId: 'amount', targetType: 'number', onError: 'null' }],
  },
  'transform.filter': { predicate: { type: 'literal', value: true } },
  'transform.derive': {
    outputName: 'Gross',
    expression: { type: 'literal', value: 1 },
  },
  'transform.sort': {
    rules: [{ columnId: 'amount', direction: 'desc', nulls: 'last' }],
  },
  'transform.deduplicate': { columnIds: ['id'], keep: 'first' },
  'aggregate.group': {
    groupBy: ['region'],
    aggregates: [{ operation: 'count', outputName: 'Rows' }],
  },
  'combine.join': {
    joinType: 'left',
    leftKeys: ['customer-id'],
    rightKeys: ['id'],
    rightColumnPrefix: 'customer.',
  },
};

const node = (kind: NodeKind, config: unknown): PipelineNode => ({
  id: `node-${kind}`,
  kind,
  label: kind,
  position: { x: 0, y: 0 },
  config,
});

describe('NodeConfigPanel', () => {
  it.each(Object.entries(configs))(
    'applies a valid %s configuration',
    (kind, config) => {
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          node={node(kind as NodeKind, config)}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '应用' }));

      expect(onChange).toHaveBeenCalledWith(`node-${kind}`, config);
      expect(screen.getByRole('status')).toHaveTextContent('配置已应用');
    },
  );

  it('shows field-level contract errors without applying invalid JSON', () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node('transform.sort', configs['transform.sort'])}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('配置 JSON'), {
      target: { value: '{"rules":[]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('配置错误')).toHaveTextContent('rules');
  });
});
