# 可视化数据转换流水线共享契约

- 契约版本：`1.0.0`
- 项目格式版本：`1`
- 状态：M0 基线已接受
- 最后更新：2026-07-11

本文档是画布、节点配置、文件适配器、执行引擎、Web Worker 和测试之间的规范性边界。关键词“必须”“不得”“应当”具有约束力。TypeScript 类型与 Zod Schema 实现在 `project/packages/contracts`；实现不得改变本文档语义。

## 双副本规则

以下文件必须逐字节一致：

- `/home/lucas/code/luke/study/topics/visual-data-pipeline/03-contracts.md`
- `/home/lucas/code/luke/project/docs/contracts.md`

任何契约变更必须同时更新两份文件，并运行：

```bash
/home/lucas/code/luke/project/scripts/check-contract-sync.sh
```

知识库副本用于规划、审计和协作；项目副本供代码仓库、CI 和开发终端使用。两份内容不一致时，契约变更不得提交。

## 1. 兼容性原则

- 项目文件只包含 JSON 可序列化数据。
- 所有外部输入、项目文件和 Worker 消息必须经过 Zod 运行时校验。
- 公共契约不得导出 React Flow、Papa Parse、SheetJS 或表格运算库的类型。
- 新增可选字段属于向后兼容变更；删除字段、重命名字段或改变字段语义属于破坏性变更。
- 破坏项目文件兼容性的变更必须提高 `formatVersion` 并提供迁移器。
- UI 不得通过解析错误文案决定行为，只能依赖稳定的 code 和结构化字段。

## 2. 基础类型

```ts
type ISODateTime = string;
type NodeId = string;
type EdgeId = string;
type PortId = string;
type ColumnId = string;
type RunId = string;

interface Position {
  x: number;
  y: number;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
```

约束：

- ID 必须在所属项目内唯一且非空。
- 时间必须使用 UTC ISO 8601 字符串。
- 画布坐标必须是有限数字。
- `zoom` 必须大于 0。

## 3. 项目文件

```ts
interface PipelineProject {
  format: 'visual-data-pipeline';
  formatVersion: 1;
  id: string;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  viewport?: Viewport;
}
```

项目文件不得包含：

- 原始文件内容或预览数据。
- `File`、`Blob`、Blob URL 或浏览器文件句柄。
- 绝对本地路径。
- 执行缓存、运行状态或诊断历史。
- 密钥、令牌、Cookie 或远程连接凭据。

保存时必须进行 Schema 校验。打开不支持的 `formatVersion` 时必须返回结构化诊断，不得静默猜测。

## 4. 节点与端口

```ts
type NodeKind =
  | 'input.csv'
  | 'input.json'
  | 'input.xlsx'
  | 'transform.select'
  | 'transform.cast'
  | 'transform.filter'
  | 'transform.derive'
  | 'transform.sort'
  | 'transform.deduplicate'
  | 'aggregate.group'
  | 'combine.join'
  | 'output.csv'
  | 'output.json'
  | 'output.xlsx';

interface PipelineNode {
  id: NodeId;
  kind: NodeKind;
  label: string;
  position: Position;
  config: unknown;
}

interface PortRef {
  nodeId: NodeId;
  portId: PortId;
}

interface PipelineEdge {
  id: EdgeId;
  source: PortRef;
  target: PortRef;
}
```

`config` 在通用外壳中为 `unknown`，但实现必须通过 `NodeConfigByKind` 和对应 Zod Schema 将其收窄为可判别联合。

端口 ID 约定：

- 单输入转换节点：输入 `in`，输出 `out`。
- 输入节点：只有输出 `out`。
- 输出节点：只有输入 `in`。
- Join 节点：输入 `left`、`right`，输出 `out`。

图规则：

- 边必须引用存在的节点和端口。
- 同一目标输入端口最多连接一条边。
- 输出端口可以连接多个下游节点。
- MVP 不允许环。
- 非输入节点必须能从至少一个输入节点到达。
- 非输出节点必须存在可到达的下游输出，未接输出允许作为警告但不得导致引擎崩溃。
- 删除节点必须同时删除关联边。

## 5. 节点配置

```ts
interface CsvInputConfig {
  sourceId: string;
  delimiter: 'auto' | ',' | ';' | '\t' | '|';
  header: boolean;
  encoding: 'utf-8';
  skipEmptyLines: boolean;
}

interface JsonInputConfig {
  sourceId: string;
  rootPath?: string;
  flattenDepth: 0 | 1;
}

interface XlsxInputConfig {
  sourceId: string;
  sheetName?: string;
  headerRow: number;
}

interface SelectColumn {
  sourceColumnId: ColumnId;
  outputName: string;
}

interface SelectConfig {
  columns: SelectColumn[];
}

type ColumnType =
  'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'unknown';

interface CastRule {
  columnId: ColumnId;
  targetType: Exclude<ColumnType, 'unknown'>;
  onError: 'fail' | 'null' | 'keep-original';
}

interface CastConfig {
  rules: CastRule[];
}

type Expression =
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'column'; columnId: ColumnId }
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

interface FilterConfig {
  predicate: Expression;
}

interface DeriveConfig {
  outputName: string;
  expression: Expression;
}

interface SortRule {
  columnId: ColumnId;
  direction: 'asc' | 'desc';
  nulls: 'first' | 'last';
}

interface SortConfig {
  rules: SortRule[];
}

interface DeduplicateConfig {
  columnIds: ColumnId[];
  keep: 'first' | 'last';
}

type AggregateOperation = 'count' | 'sum' | 'avg' | 'min' | 'max';

interface AggregateSpec {
  operation: AggregateOperation;
  columnId?: ColumnId;
  outputName: string;
}

interface GroupConfig {
  groupBy: ColumnId[];
  aggregates: AggregateSpec[];
}

interface JoinConfig {
  joinType: 'inner' | 'left';
  leftKeys: ColumnId[];
  rightKeys: ColumnId[];
  rightColumnPrefix: string;
}

interface CsvOutputConfig {
  delimiter: ',' | ';' | '\t' | '|';
  includeHeader: boolean;
  fileName: string;
}

interface JsonOutputConfig {
  shape: 'array-of-objects';
  pretty: boolean;
  fileName: string;
}

interface XlsxOutputConfig {
  sheetName: string;
  fileName: string;
}
```

约束：

- 表达式只允许上述 AST，不接受 JavaScript、SQL 或任意代码字符串。
- Join 的左右键数量必须相同且至少为 1。
- 字段重命名、计算字段和聚合输出不得产生重复名称。
- 输出文件名不得包含路径分隔符。
- 节点配置必须在执行前校验，配置错误必须携带 `nodeId` 和 `fieldPath`。

## 6. 数据与 Schema

```ts
type CellValue = string | number | boolean | null;

interface DataColumn {
  id: ColumnId;
  name: string;
  type: ColumnType;
  nullable: boolean;
}

interface DataSchema {
  columns: DataColumn[];
}

interface DataBatch {
  schema: DataSchema;
  rows: CellValue[][];
  offset: number;
  totalRows?: number;
}
```

约束：

- `rows` 中每行长度必须等于 `schema.columns.length`。
- 日期和日期时间跨公共边界时使用 ISO 字符串，语义由 `ColumnType` 表示，不传递 JavaScript `Date`。
- 列 ID 在节点输出 Schema 内必须唯一；显示名称也不得重复。
- 完整数据集可以使用引擎内部结构，但 UI 只接收限制大小的预览批次。
- MVP 预览上限为 1000 行；该值是产品限制，不代表执行数据上限。

## 7. 数据源绑定

项目文件只保存 `sourceId`。浏览器会话中的真实文件使用独立运行时绑定：

```ts
interface SourceBinding {
  sourceId: string;
  displayName: string;
  file: File;
  size: number;
  lastModified: number;
}
```

`SourceBinding` 不得写入项目 JSON，也不得发送到除本地 Worker 以外的任何目标。重新打开项目后，缺失绑定必须产生 `SOURCE_BINDING_MISSING` 诊断并提示用户重新选择文件。

## 8. 执行协议

```ts
type NodeRunStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'warning'
  | 'failed'
  | 'cancelled';

interface NodeRunResult {
  nodeId: NodeId;
  status: Extract<
    NodeRunStatus,
    'succeeded' | 'warning' | 'failed' | 'cancelled'
  >;
  inputRows: number;
  outputRows: number;
  durationMs: number;
  diagnostics: Diagnostic[];
}

interface RunSummary {
  runId: RunId;
  status: 'succeeded' | 'warning' | 'failed' | 'cancelled';
  startedAt: ISODateTime;
  finishedAt: ISODateTime;
  nodeResults: NodeRunResult[];
}
```

状态转换：

- `idle -> queued -> running`
- `running -> succeeded | warning | failed | cancelled`
- 终态不得直接返回 `running`。
- 用户取消后不得启动新的下游节点。
- 相同输入、项目和配置应产生相同数据结果；耗时和时间戳不要求相同。

## 9. Worker 消息

```ts
type WorkerCommand =
  | { type: 'ping'; requestId: string }
  | {
      type: 'run';
      runId: RunId;
      project: PipelineProject;
      sources: SourceBinding[];
      targetNodeId?: NodeId;
    }
  | { type: 'cancel'; runId: RunId }
  | {
      type: 'preview';
      requestId: string;
      runId: RunId;
      nodeId: NodeId;
      offset: number;
      limit: number;
    };

type WorkerEvent =
  | { type: 'pong'; requestId: string }
  | { type: 'run-started'; runId: RunId; startedAt: ISODateTime }
  | {
      type: 'node-progress';
      runId: RunId;
      nodeId: NodeId;
      progress?: number;
      message?: string;
    }
  | { type: 'node-result'; runId: RunId; result: NodeRunResult }
  | {
      type: 'preview-result';
      requestId: string;
      runId: RunId;
      nodeId: NodeId;
      batch: DataBatch;
    }
  | { type: 'run-completed'; runId: RunId; summary: RunSummary }
  | { type: 'run-failed'; runId: RunId; diagnostics: Diagnostic[] }
  | { type: 'run-cancelled'; runId: RunId; finishedAt: ISODateTime };
```

协议要求：

- UI 必须忽略不属于当前活动 `runId` 的迟到运行消息。
- Worker 必须校验所有命令；UI 必须校验所有事件。
- `progress` 存在时必须位于 0 到 1。
- `preview.limit` 必须位于 1 到 1000。
- 取消命令必须幂等。
- Worker 内部异常必须转换为诊断，不得把原始堆栈作为用户消息。

## 10. 诊断

```ts
type DiagnosticSeverity = 'info' | 'warning' | 'error';

interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  nodeId?: NodeId;
  fieldPath?: string;
  rowNumber?: number;
  details?: Record<string, string | number | boolean | null>;
}
```

诊断 code 使用大写下划线命名。首批稳定 code：

- `PROJECT_FORMAT_INVALID`
- `PROJECT_VERSION_UNSUPPORTED`
- `NODE_CONFIG_INVALID`
- `EDGE_REFERENCE_INVALID`
- `PORT_CONNECTION_INVALID`
- `GRAPH_CYCLE_DETECTED`
- `GRAPH_NODE_UNREACHABLE`
- `SOURCE_BINDING_MISSING`
- `SOURCE_PARSE_FAILED`
- `COLUMN_REFERENCE_MISSING`
- `CAST_VALUE_INVALID`
- `EXPRESSION_INVALID`
- `JOIN_KEY_INVALID`
- `RUN_CANCELLED`
- `WORKER_PROTOCOL_INVALID`
- `INTERNAL_EXECUTION_ERROR`

规则：

- `error` 阻止相关节点成功。
- `warning` 允许节点完成，但总运行状态至少为 `warning`。
- `message` 面向用户，允许本地化；`code` 语义必须稳定。
- `details` 不得包含整行数据、密钥、绝对路径或超长单元格。
- 行号面向用户时从 1 开始。

## 11. 节点注册接口

每个 `NodeKind` 必须且只能注册一次：

```ts
interface NodeDefinition<K extends NodeKind = NodeKind> {
  kind: K;
  inputPorts: readonly PortId[];
  outputPorts: readonly PortId[];
  configSchema: unknown;
  defaultConfig: unknown;
}
```

UI 注册表和引擎执行器注册表必须共享同一组 `NodeKind` 完整性测试。缺少配置 Schema、默认配置、UI 或执行器的节点不得进入发布构建。

## 12. 安全与隐私

- 禁止 `eval`、`new Function` 和动态脚本加载。
- CSV/XLSX 导出必须防止以 `=`、`+`、`-`、`@` 开头的文本被解释为公式。
- 不信任扩展名，必须验证实际解析结果。
- 不向网络发送源文件、预览、诊断样例或项目内容。
- 日志默认只记录节点 ID、行数、耗时和诊断 code。
- 测试夹具必须使用虚构数据，不得使用公司真实数据或个人信息。

## 13. 契约测试义务

`packages/contracts` 至少包含：

- 每个 Schema 的有效和无效样例。
- 项目 JSON 序列化往返测试。
- 所有 `NodeKind` 的配置 Schema 完整性测试。
- 边、端口、环和不可达节点测试。
- Worker 命令和事件解析测试。
- `runId` 迟到消息隔离测试。
- 项目格式版本拒绝和迁移入口测试。
- 两份 Markdown 契约同步检查。

每个节点至少包含一个成功测试、一个配置失败测试和一个数据失败测试。

## 14. 变更流程

1. 在知识库 `decisions.md` 提交变更原因、兼容性和备选方案。
2. 同时修改两份契约 Markdown。
3. 修改 `packages/contracts` 的类型和 Zod Schema。
4. 更新契约、序列化和迁移测试。
5. 运行契约同步、lint、typecheck 和相关测试。
6. 主终端审核并合并契约基线。
7. 通知其他终端同步主分支后继续开发。

未经主终端协调，各模块不得创建同义但不兼容的公共类型。内部实现类型可以自由变化，但跨包、跨 Worker、项目文件和 UI/引擎边界必须使用本契约。
