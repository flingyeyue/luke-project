import type { PipelineProject } from '../src';

export const validProject: PipelineProject = {
  format: 'visual-data-pipeline',
  formatVersion: 1,
  id: 'project-1',
  name: 'Orders cleanup',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
  nodes: [
    {
      id: 'csv-1',
      kind: 'input.csv',
      label: 'Orders CSV',
      position: { x: 0, y: 0 },
      config: {
        sourceId: 'orders-source',
        delimiter: 'auto',
        header: true,
        encoding: 'utf-8',
        skipEmptyLines: true,
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};
