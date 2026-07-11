import { z } from 'zod';

const idSchema = z.string().trim().min(1);
const finiteNumberSchema = z.number().finite();
const isoDateTimeSchema = z.iso.datetime({ offset: false });

export const positionSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
});

export const viewportSchema = positionSchema.extend({
  zoom: finiteNumberSchema.positive(),
});

export const nodeKindSchema = z.enum([
  'input.csv',
  'input.json',
  'input.xlsx',
  'transform.select',
  'transform.cast',
  'transform.filter',
  'transform.derive',
  'transform.sort',
  'transform.deduplicate',
  'aggregate.group',
  'combine.join',
  'output.csv',
  'output.json',
  'output.xlsx',
]);

export const columnTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'unknown',
]);

export type Expression =
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'column'; columnId: string }
  | { type: 'unary'; operator: 'not' | 'is-null'; operand: Expression }
  | {
      type: 'binary';
      operator:
        | 'eq'
        | 'neq'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | 'and'
        | 'or'
        | 'add'
        | 'subtract'
        | 'multiply'
        | 'divide';
      left: Expression;
      right: Expression;
    };

export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('literal'),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }),
    z.object({
      type: z.literal('column'),
      columnId: idSchema,
    }),
    z.object({
      type: z.literal('unary'),
      operator: z.enum(['not', 'is-null']),
      operand: expressionSchema,
    }),
    z.object({
      type: z.literal('binary'),
      operator: z.enum([
        'eq',
        'neq',
        'gt',
        'gte',
        'lt',
        'lte',
        'and',
        'or',
        'add',
        'subtract',
        'multiply',
        'divide',
      ]),
      left: expressionSchema,
      right: expressionSchema,
    }),
  ]),
);

export const csvInputConfigSchema = z.object({
  sourceId: idSchema,
  delimiter: z.enum(['auto', ',', ';', '\t', '|']),
  header: z.boolean(),
  encoding: z.literal('utf-8'),
  skipEmptyLines: z.boolean(),
});

export const jsonInputConfigSchema = z.object({
  sourceId: idSchema,
  rootPath: z.string().optional(),
  flattenDepth: z.union([z.literal(0), z.literal(1)]),
});

export const xlsxInputConfigSchema = z.object({
  sourceId: idSchema,
  sheetName: z.string().trim().min(1).optional(),
  headerRow: z.number().int().min(1),
});

export const selectConfigSchema = z.object({
  columns: z
    .array(
      z.object({
        sourceColumnId: idSchema,
        outputName: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export const castConfigSchema = z.object({
  rules: z
    .array(
      z.object({
        columnId: idSchema,
        targetType: z.enum(['string', 'number', 'boolean', 'date', 'datetime']),
        onError: z.enum(['fail', 'null', 'keep-original']),
      }),
    )
    .min(1),
});

export const filterConfigSchema = z.object({
  predicate: expressionSchema,
});

export const deriveConfigSchema = z.object({
  outputName: z.string().trim().min(1),
  expression: expressionSchema,
});

export const sortConfigSchema = z.object({
  rules: z
    .array(
      z.object({
        columnId: idSchema,
        direction: z.enum(['asc', 'desc']),
        nulls: z.enum(['first', 'last']),
      }),
    )
    .min(1),
});

export const deduplicateConfigSchema = z.object({
  columnIds: z.array(idSchema).min(1),
  keep: z.enum(['first', 'last']),
});

export const groupConfigSchema = z.object({
  groupBy: z.array(idSchema),
  aggregates: z
    .array(
      z.object({
        operation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
        columnId: idSchema.optional(),
        outputName: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export const joinConfigSchema = z
  .object({
    joinType: z.enum(['inner', 'left']),
    leftKeys: z.array(idSchema).min(1),
    rightKeys: z.array(idSchema).min(1),
    rightColumnPrefix: z.string(),
  })
  .refine((value) => value.leftKeys.length === value.rightKeys.length, {
    message: 'Join key counts must match.',
    path: ['rightKeys'],
  });

const safeFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[\\/]/u.test(value), 'File name cannot contain a path.');

export const csvOutputConfigSchema = z.object({
  delimiter: z.enum([',', ';', '\t', '|']),
  includeHeader: z.boolean(),
  fileName: safeFileNameSchema,
});

export const jsonOutputConfigSchema = z.object({
  shape: z.literal('array-of-objects'),
  pretty: z.boolean(),
  fileName: safeFileNameSchema,
});

export const xlsxOutputConfigSchema = z.object({
  sheetName: z.string().trim().min(1),
  fileName: safeFileNameSchema,
});

export const nodeConfigSchemaByKind = {
  'input.csv': csvInputConfigSchema,
  'input.json': jsonInputConfigSchema,
  'input.xlsx': xlsxInputConfigSchema,
  'transform.select': selectConfigSchema,
  'transform.cast': castConfigSchema,
  'transform.filter': filterConfigSchema,
  'transform.derive': deriveConfigSchema,
  'transform.sort': sortConfigSchema,
  'transform.deduplicate': deduplicateConfigSchema,
  'aggregate.group': groupConfigSchema,
  'combine.join': joinConfigSchema,
  'output.csv': csvOutputConfigSchema,
  'output.json': jsonOutputConfigSchema,
  'output.xlsx': xlsxOutputConfigSchema,
} as const;

export const pipelineNodeSchema = z
  .object({
    id: idSchema,
    kind: nodeKindSchema,
    label: z.string().trim().min(1),
    position: positionSchema,
    config: z.unknown(),
  })
  .superRefine((node, context) => {
    const result = nodeConfigSchemaByKind[node.kind].safeParse(node.config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: 'custom',
          message: issue.message,
          path: ['config', ...issue.path],
        });
      }
    }
  });

export const portRefSchema = z.object({
  nodeId: idSchema,
  portId: idSchema,
});

export const pipelineEdgeSchema = z.object({
  id: idSchema,
  source: portRefSchema,
  target: portRefSchema,
});

export const pipelineProjectSchema = z.object({
  format: z.literal('visual-data-pipeline'),
  formatVersion: z.literal(1),
  id: idSchema,
  name: z.string().trim().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  nodes: z.array(pipelineNodeSchema),
  edges: z.array(pipelineEdgeSchema),
  viewport: viewportSchema.optional(),
});

export const dataColumnSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  type: columnTypeSchema,
  nullable: z.boolean(),
});

export const dataSchemaSchema = z.object({
  columns: z.array(dataColumnSchema),
});

export const cellValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const dataBatchSchema = z
  .object({
    schema: dataSchemaSchema,
    rows: z.array(z.array(cellValueSchema)),
    offset: z.number().int().min(0),
    totalRows: z.number().int().min(0).optional(),
  })
  .superRefine((batch, context) => {
    const width = batch.schema.columns.length;
    batch.rows.forEach((row, index) => {
      if (row.length !== width) {
        context.addIssue({
          code: 'custom',
          message: `Expected ${width} cells, received ${row.length}.`,
          path: ['rows', index],
        });
      }
    });
  });

export const sourceBindingSchema = z.object({
  sourceId: idSchema,
  displayName: z.string().trim().min(1),
  file: z.instanceof(File),
  size: z.number().int().min(0),
  lastModified: z.number().int().min(0),
});

export const nodeRunStatusSchema = z.enum([
  'idle',
  'queued',
  'running',
  'succeeded',
  'warning',
  'failed',
  'cancelled',
]);

export const diagnosticSeveritySchema = z.enum(['info', 'warning', 'error']);

export const diagnosticSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/u),
  severity: diagnosticSeveritySchema,
  message: z.string().min(1),
  nodeId: idSchema.optional(),
  fieldPath: z.string().min(1).optional(),
  rowNumber: z.number().int().min(1).optional(),
  details: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

export const nodeRunResultSchema = z.object({
  nodeId: idSchema,
  status: z.enum(['succeeded', 'warning', 'failed', 'cancelled']),
  inputRows: z.number().int().min(0),
  outputRows: z.number().int().min(0),
  durationMs: z.number().finite().min(0),
  diagnostics: z.array(diagnosticSchema),
});

export const runSummarySchema = z.object({
  runId: idSchema,
  status: z.enum(['succeeded', 'warning', 'failed', 'cancelled']),
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema,
  nodeResults: z.array(nodeRunResultSchema),
});

export const workerCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping'), requestId: idSchema }),
  z.object({
    type: z.literal('run'),
    runId: idSchema,
    project: pipelineProjectSchema,
    sources: z.array(sourceBindingSchema),
    targetNodeId: idSchema.optional(),
  }),
  z.object({ type: z.literal('cancel'), runId: idSchema }),
  z.object({
    type: z.literal('preview'),
    requestId: idSchema,
    runId: idSchema,
    nodeId: idSchema,
    offset: z.number().int().min(0),
    limit: z.number().int().min(1).max(1000),
  }),
]);

export const workerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pong'), requestId: idSchema }),
  z.object({
    type: z.literal('run-started'),
    runId: idSchema,
    startedAt: isoDateTimeSchema,
  }),
  z.object({
    type: z.literal('node-progress'),
    runId: idSchema,
    nodeId: idSchema,
    progress: z.number().min(0).max(1).optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('node-result'),
    runId: idSchema,
    result: nodeRunResultSchema,
  }),
  z.object({
    type: z.literal('preview-result'),
    requestId: idSchema,
    runId: idSchema,
    nodeId: idSchema,
    batch: dataBatchSchema,
  }),
  z.object({
    type: z.literal('run-completed'),
    runId: idSchema,
    summary: runSummarySchema,
  }),
  z.object({
    type: z.literal('run-failed'),
    runId: idSchema,
    diagnostics: z.array(diagnosticSchema).min(1),
  }),
  z.object({
    type: z.literal('run-cancelled'),
    runId: idSchema,
    finishedAt: isoDateTimeSchema,
  }),
]);

export type NodeKind = z.infer<typeof nodeKindSchema>;
export type ColumnType = z.infer<typeof columnTypeSchema>;
export type PipelineNode = z.infer<typeof pipelineNodeSchema>;
export type PipelineEdge = z.infer<typeof pipelineEdgeSchema>;
export type PipelineProject = z.infer<typeof pipelineProjectSchema>;
export type DataColumn = z.infer<typeof dataColumnSchema>;
export type DataSchema = z.infer<typeof dataSchemaSchema>;
export type CellValue = z.infer<typeof cellValueSchema>;
export type DataBatch = z.infer<typeof dataBatchSchema>;
export type SourceBinding = z.infer<typeof sourceBindingSchema>;
export type NodeRunStatus = z.infer<typeof nodeRunStatusSchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type NodeRunResult = z.infer<typeof nodeRunResultSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type WorkerCommand = z.infer<typeof workerCommandSchema>;
export type WorkerEvent = z.infer<typeof workerEventSchema>;

export type NodeConfigByKind = {
  [K in keyof typeof nodeConfigSchemaByKind]: z.infer<
    (typeof nodeConfigSchemaByKind)[K]
  >;
};
