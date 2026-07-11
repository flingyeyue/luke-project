import { type NodeKind, nodeConfigSchemaByKind } from '@luke/contracts';

export interface ConfigIssue {
  path: string;
  message: string;
}

export interface ConfigValidation {
  valid: boolean;
  value?: unknown;
  issues: ConfigIssue[];
}

export function validateNodeConfig(
  kind: NodeKind,
  value: unknown,
): ConfigValidation {
  const result = nodeConfigSchemaByKind[kind].safeParse(value);
  if (result.success) {
    return { valid: true, value: result.data, issues: [] };
  }
  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({
      path: ['config', ...issue.path].join('.'),
      message: issue.message,
    })),
  };
}
