import {
  type DataBatch,
  type PipelineNode,
  nodeConfigSchemaByKind,
} from '@luke/contracts';

import { executeCast } from './cast';
import { executeSelect } from './select';
import type { TransformResult } from './types';

export function executeTransformNode(
  node: PipelineNode,
  input: DataBatch,
): TransformResult {
  switch (node.kind) {
    case 'transform.select': {
      const parsed = nodeConfigSchemaByKind['transform.select'].safeParse(
        node.config,
      );
      if (parsed.success) return executeSelect(input, parsed.data, node.id);
      return invalidConfig(node, input, parsed.error.message);
    }
    case 'transform.cast': {
      const parsed = nodeConfigSchemaByKind['transform.cast'].safeParse(
        node.config,
      );
      if (parsed.success) return executeCast(input, parsed.data, node.id);
      return invalidConfig(node, input, parsed.error.message);
    }
    default:
      return {
        batch: input,
        diagnostics: [
          {
            code: 'NODE_KIND_NOT_IMPLEMENTED',
            severity: 'error',
            message: `No data transform executor is registered for ${node.kind}.`,
            nodeId: node.id,
          },
        ],
      };
  }
}

function invalidConfig(
  node: PipelineNode,
  input: DataBatch,
  message: string,
): TransformResult {
  return {
    batch: input,
    diagnostics: [
      {
        code: 'NODE_CONFIG_INVALID',
        severity: 'error',
        message,
        nodeId: node.id,
        fieldPath: 'config',
      },
    ],
  };
}
