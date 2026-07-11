import type { PipelineProject } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { openProjectText, saveProjectFile } from '../src';

const project: PipelineProject = {
  format: 'visual-data-pipeline',
  formatVersion: 1,
  id: 'project-1',
  name: 'Orders cleanup',
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
  nodes: [
    {
      id: 'input-1',
      kind: 'input.csv',
      label: 'Orders',
      position: { x: 0, y: 0 },
      config: {
        sourceId: 'orders',
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

describe('project files', () => {
  it('round-trips a versioned project without runtime data', () => {
    const saved = saveProjectFile(project);
    const opened = openProjectText(saved.content);

    expect(saved.fileName).toBe('Orders-cleanup.vdp.json');
    expect(opened).toEqual({ project, diagnostics: [] });
    expect(saved.content).not.toContain('rows');
    expect(saved.content).not.toContain('file');
  });

  it('rejects malformed JSON and unsupported format versions', () => {
    expect(openProjectText('{').diagnostics[0]).toMatchObject({
      code: 'PROJECT_FORMAT_INVALID',
    });
    const unsupported = { ...project, formatVersion: 2 };
    expect(
      openProjectText(JSON.stringify(unsupported)).diagnostics[0],
    ).toMatchObject({
      code: 'PROJECT_FORMAT_INVALID',
      fieldPath: 'formatVersion',
    });
  });

  it('rejects invalid node configuration with a field path', () => {
    const invalid = structuredClone(project);
    invalid.nodes[0]!.config = { sourceId: '' };
    expect(
      openProjectText(JSON.stringify(invalid)).diagnostics[0],
    ).toMatchObject({
      code: 'PROJECT_FORMAT_INVALID',
    });
    expect(
      openProjectText(JSON.stringify(invalid)).diagnostics[0]?.fieldPath,
    ).toContain('config');
  });
});
