import type { DataBatch, Diagnostic } from '@luke/contracts';

export interface ParsedSource {
  batch: DataBatch;
  diagnostics: Diagnostic[];
}
