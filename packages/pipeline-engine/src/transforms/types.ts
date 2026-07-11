import type { DataBatch, Diagnostic } from '@luke/contracts';

export interface TransformResult {
  batch: DataBatch;
  diagnostics: Diagnostic[];
}
