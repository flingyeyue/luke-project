import type { PipelineProject } from '@luke/contracts';

const time = '2026-07-11T12:00:00.000Z';

export const linearProject: PipelineProject = {
  format: 'visual-data-pipeline',
  formatVersion: 1,
  id: 'project-1',
  name: 'Linear pipeline',
  createdAt: time,
  updatedAt: time,
  nodes: [
    {
      id: 'input',
      kind: 'input.csv',
      label: 'Input',
      position: { x: 0, y: 0 },
      config: {
        sourceId: 'source',
        delimiter: 'auto',
        header: true,
        encoding: 'utf-8',
        skipEmptyLines: true,
      },
    },
    {
      id: 'filter',
      kind: 'transform.filter',
      label: 'Filter',
      position: { x: 200, y: 0 },
      config: { predicate: { type: 'literal', value: true } },
    },
    {
      id: 'output',
      kind: 'output.csv',
      label: 'Output',
      position: { x: 400, y: 0 },
      config: { delimiter: ',', includeHeader: true, fileName: 'out.csv' },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: { nodeId: 'input', portId: 'out' },
      target: { nodeId: 'filter', portId: 'in' },
    },
    {
      id: 'edge-2',
      source: { nodeId: 'filter', portId: 'out' },
      target: { nodeId: 'output', portId: 'in' },
    },
  ],
};
