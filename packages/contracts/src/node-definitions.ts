import type { NodeKind } from './schemas';

export interface NodeDefinition {
  kind: NodeKind;
  inputPorts: readonly string[];
  outputPorts: readonly string[];
}

export const nodeDefinitions = {
  'input.csv': { kind: 'input.csv', inputPorts: [], outputPorts: ['out'] },
  'input.json': { kind: 'input.json', inputPorts: [], outputPorts: ['out'] },
  'input.xlsx': { kind: 'input.xlsx', inputPorts: [], outputPorts: ['out'] },
  'transform.select': {
    kind: 'transform.select',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'transform.cast': {
    kind: 'transform.cast',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'transform.filter': {
    kind: 'transform.filter',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'transform.derive': {
    kind: 'transform.derive',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'transform.sort': {
    kind: 'transform.sort',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'transform.deduplicate': {
    kind: 'transform.deduplicate',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'aggregate.group': {
    kind: 'aggregate.group',
    inputPorts: ['in'],
    outputPorts: ['out'],
  },
  'combine.join': {
    kind: 'combine.join',
    inputPorts: ['left', 'right'],
    outputPorts: ['out'],
  },
  'output.csv': { kind: 'output.csv', inputPorts: ['in'], outputPorts: [] },
  'output.json': { kind: 'output.json', inputPorts: ['in'], outputPorts: [] },
  'output.xlsx': { kind: 'output.xlsx', inputPorts: ['in'], outputPorts: [] },
} as const satisfies Record<NodeKind, NodeDefinition>;
