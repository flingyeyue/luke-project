import {
  type Diagnostic,
  type PipelineProject,
  pipelineProjectSchema,
} from '@luke/contracts';

import type { ExportedFile } from './export';

export interface OpenProjectResult {
  project?: PipelineProject;
  diagnostics: Diagnostic[];
}

export function saveProjectFile(project: PipelineProject): ExportedFile {
  const validated = pipelineProjectSchema.parse(project);
  return {
    fileName: `${safeProjectName(validated.name)}.vdp.json`,
    mimeType: 'application/json;charset=utf-8',
    content: JSON.stringify(validated, null, 2),
  };
}

export function openProjectText(text: string): OpenProjectResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : 'Project JSON is invalid.',
    );
  }
  const validated = pipelineProjectSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      diagnostics: validated.error.issues.map((issue) => ({
        code: 'PROJECT_FORMAT_INVALID',
        severity: 'error',
        message: issue.message,
        fieldPath: issue.path.join('.') || 'project',
      })),
    };
  }
  return { project: validated.data, diagnostics: [] };
}

export async function openProjectFile(file: File): Promise<OpenProjectResult> {
  try {
    return openProjectText(await file.text());
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : 'Project file could not be read.',
    );
  }
}

function failure(message: string): OpenProjectResult {
  return {
    diagnostics: [
      { code: 'PROJECT_FORMAT_INVALID', severity: 'error', message },
    ],
  };
}

function safeProjectName(name: string): string {
  const safe = name
    .trim()
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-|-$/gu, '');
  return safe || 'pipeline';
}
