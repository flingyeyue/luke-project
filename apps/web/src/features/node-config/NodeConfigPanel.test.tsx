import type { NodeKind, PipelineNode } from '@luke/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NodeConfigPanel } from './NodeConfigPanel';

const configs: Record<NodeKind, unknown> = {
  'input.csv': {
    sourceId: 'orders',
    delimiter: 'auto',
    header: true,
    encoding: 'utf-8',
    skipEmptyLines: true,
  },
  'input.json': { sourceId: 'records', rootPath: 'data', flattenDepth: 1 },
  'input.xlsx': { sourceId: 'workbook', sheetName: 'Orders', headerRow: 1 },
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
  'output.csv': {
    delimiter: ',',
    includeHeader: true,
    fileName: 'orders.csv',
  },
  'output.json': {
    shape: 'array-of-objects',
    pretty: true,
    fileName: 'orders.json',
  },
  'output.xlsx': { sheetName: 'Orders', fileName: 'orders.xlsx' },
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
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    fireEvent.change(screen.getByLabelText('配置 JSON'), {
      target: { value: '{"rules":[]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('配置错误')).toHaveTextContent('rules');
  });

  it('edits and applies a configuration in visual mode', () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node('transform.sort', configs['transform.sort'])}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('方向'), {
      target: { value: 'asc' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onChange).toHaveBeenCalledWith('node-transform.sort', {
      rules: [{ columnId: 'amount', direction: 'asc', nulls: 'last' }],
    });
  });

  it('synchronizes valid changes between visual and JSON modes', () => {
    const onChange = vi.fn();
    render(
      <NodeConfigPanel
        node={node('combine.join', configs['combine.join'])}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('右侧字段前缀'), {
      target: { value: 'lookup.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('配置 JSON').value,
    ).toContain('lookup.');

    fireEvent.change(screen.getByLabelText('配置 JSON'), {
      target: {
        value: JSON.stringify({
          ...(configs['combine.join'] as Record<string, unknown>),
          rightColumnPrefix: 'json.',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '可视化' }));

    expect(screen.getByLabelText('右侧字段前缀')).toHaveValue('json.');
  });

  it('stays in JSON mode when the draft violates the contract', () => {
    render(
      <NodeConfigPanel
        node={node('transform.sort', configs['transform.sort'])}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    fireEvent.change(screen.getByLabelText('配置 JSON'), {
      target: { value: '{"rules":[]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '可视化' }));

    expect(screen.getByLabelText('配置 JSON')).toBeInTheDocument();
    expect(screen.getByLabelText('配置错误')).toHaveTextContent('rules');
  });
});
