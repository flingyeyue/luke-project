import {
  type DataBatch,
  type PipelineNode,
  nodeConfigSchemaByKind,
} from '@luke/contracts';

import { executeCast } from './cast';
import { executeDerive } from './derive';
import { executeDeduplicate } from './deduplicate';
import { executeFilter } from './filter';
import { executeSelect } from './select';
import { executeSort } from './sort';
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
    case 'transform.filter': {
      const parsed = nodeConfigSchemaByKind['transform.filter'].safeParse(
        node.config,
      );
      if (parsed.success) return executeFilter(input, parsed.data, node.id);
      return invalidConfig(node, input, parsed.error.message);
    }
    case 'transform.derive': {
      const parsed = nodeConfigSchemaByKind['transform.derive'].safeParse(
        node.config,
      );
      if (parsed.success) return executeDerive(input, parsed.data, node.id);
      return invalidConfig(node, input, parsed.error.message);
    }
    case 'transform.sort': {
      const parsed = nodeConfigSchemaByKind['transform.sort'].safeParse(
        node.config,
      );
      if (parsed.success) return executeSort(input, parsed.data, node.id);
      return invalidConfig(node, input, parsed.error.message);
    }
    case 'transform.deduplicate': {
      const parsed = nodeConfigSchemaByKind['transform.deduplicate'].safeParse(
        node.config,
      );
      if (parsed.success) {
        return executeDeduplicate(input, parsed.data, node.id);
      }
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
