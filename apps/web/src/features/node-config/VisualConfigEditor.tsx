import type { DataColumn, NodeConfigByKind, NodeKind } from '@luke/contracts';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { ExpressionEditor } from './ExpressionEditor';

interface VisualConfigEditorProps {
  columns?: DataColumn[];
  kind: NodeKind;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function VisualConfigEditor({
  columns = [],
  kind,
  value,
  onChange,
}: VisualConfigEditorProps) {
  return (
    <>
      <ConfigFields kind={kind} onChange={onChange} value={value} />
      <datalist id="pipeline-column-options">
        {columns.map((column) => (
          <option key={column.id} value={column.id}>
            {column.name}
          </option>
        ))}
      </datalist>
    </>
  );
}

function ConfigFields({ kind, value, onChange }: VisualConfigEditorProps) {
  switch (kind) {
    case 'input.csv':
      return (
        <CsvInputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['input.csv']}
        />
      );
    case 'input.json':
      return (
        <JsonInputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['input.json']}
        />
      );
    case 'input.xlsx':
      return (
        <XlsxInputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['input.xlsx']}
        />
      );
    case 'transform.select':
      return (
        <SelectEditor
          onChange={onChange}
          value={value as NodeConfigByKind['transform.select']}
        />
      );
    case 'transform.cast':
      return (
        <CastEditor
          onChange={onChange}
          value={value as NodeConfigByKind['transform.cast']}
        />
      );
    case 'transform.filter':
      return (
        <ExpressionEditor
          label="筛选条件"
          onChange={(predicate) => onChange({ predicate })}
          value={(value as NodeConfigByKind['transform.filter']).predicate}
        />
      );
    case 'transform.derive':
      return (
        <DeriveEditor
          onChange={onChange}
          value={value as NodeConfigByKind['transform.derive']}
        />
      );
    case 'transform.sort':
      return (
        <SortEditor
          onChange={onChange}
          value={value as NodeConfigByKind['transform.sort']}
        />
      );
    case 'transform.deduplicate':
      return (
        <DeduplicateEditor
          onChange={onChange}
          value={value as NodeConfigByKind['transform.deduplicate']}
        />
      );
    case 'aggregate.group':
      return (
        <GroupEditor
          onChange={onChange}
          value={value as NodeConfigByKind['aggregate.group']}
        />
      );
    case 'combine.join':
      return (
        <JoinEditor
          onChange={onChange}
          value={value as NodeConfigByKind['combine.join']}
        />
      );
    case 'output.csv':
      return (
        <CsvOutputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['output.csv']}
        />
      );
    case 'output.json':
      return (
        <JsonOutputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['output.json']}
        />
      );
    case 'output.xlsx':
      return (
        <XlsxOutputEditor
          onChange={onChange}
          value={value as NodeConfigByKind['output.xlsx']}
        />
      );
  }
}

type ChangeHandler = (value: unknown) => void;

function CsvInputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['input.csv']>) {
  return (
    <FormFields>
      <TextField
        label="数据源 ID"
        value={value.sourceId}
        onChange={(sourceId) => onChange({ ...value, sourceId })}
      />
      <SelectField
        label="分隔符"
        value={value.delimiter}
        options={[
          ['auto', '自动检测'],
          [',', '逗号'],
          [';', '分号'],
          ['\t', '制表符'],
          ['|', '竖线'],
        ]}
        onChange={(delimiter) => onChange({ ...value, delimiter })}
      />
      <CheckboxField
        label="首行为字段名"
        checked={value.header}
        onChange={(header) => onChange({ ...value, header })}
      />
      <CheckboxField
        label="跳过空行"
        checked={value.skipEmptyLines}
        onChange={(skipEmptyLines) => onChange({ ...value, skipEmptyLines })}
      />
    </FormFields>
  );
}

function JsonInputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['input.json']>) {
  return (
    <FormFields>
      <TextField
        label="数据源 ID"
        value={value.sourceId}
        onChange={(sourceId) => onChange({ ...value, sourceId })}
      />
      <TextField
        label="根路径"
        value={value.rootPath ?? ''}
        placeholder="可选，例如 data.items"
        onChange={(rootPath) =>
          onChange({ ...value, rootPath: rootPath || undefined })
        }
      />
      <SelectField
        label="展开层级"
        value={String(value.flattenDepth)}
        options={[
          ['0', '不展开'],
          ['1', '展开一层'],
        ]}
        onChange={(depth) =>
          onChange({ ...value, flattenDepth: Number(depth) as 0 | 1 })
        }
      />
    </FormFields>
  );
}

function XlsxInputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['input.xlsx']>) {
  return (
    <FormFields>
      <TextField
        label="数据源 ID"
        value={value.sourceId}
        onChange={(sourceId) => onChange({ ...value, sourceId })}
      />
      <TextField
        label="工作表名称"
        value={value.sheetName ?? ''}
        placeholder="可选，默认第一个工作表"
        onChange={(sheetName) =>
          onChange({ ...value, sheetName: sheetName || undefined })
        }
      />
      <NumberField
        label="字段名所在行"
        min={1}
        value={value.headerRow}
        onChange={(headerRow) => onChange({ ...value, headerRow })}
      />
    </FormFields>
  );
}

function SelectEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['transform.select']>) {
  return (
    <RuleList
      label="字段映射"
      onAdd={() =>
        onChange({
          columns: [
            ...value.columns,
            { sourceColumnId: 'column-1', outputName: 'Column' },
          ],
        })
      }
    >
      {value.columns.map((column, index) => (
        <RuleItem
          key={index}
          label={`映射 ${index + 1}`}
          onRemove={
            value.columns.length > 1
              ? () => onChange({ columns: removeAt(value.columns, index) })
              : undefined
          }
        >
          <TextField
            columnOptions
            label="源字段 ID"
            value={column.sourceColumnId}
            onChange={(sourceColumnId) =>
              onChange({
                columns: replaceAt(value.columns, index, {
                  ...column,
                  sourceColumnId,
                }),
              })
            }
          />
          <TextField
            label="输出字段名"
            value={column.outputName}
            onChange={(outputName) =>
              onChange({
                columns: replaceAt(value.columns, index, {
                  ...column,
                  outputName,
                }),
              })
            }
          />
        </RuleItem>
      ))}
    </RuleList>
  );
}

function CastEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['transform.cast']>) {
  return (
    <RuleList
      label="类型转换规则"
      onAdd={() =>
        onChange({
          rules: [
            ...value.rules,
            { columnId: 'column-1', targetType: 'string', onError: 'fail' },
          ],
        })
      }
    >
      {value.rules.map((rule, index) => (
        <RuleItem
          key={index}
          label={`规则 ${index + 1}`}
          onRemove={
            value.rules.length > 1
              ? () => onChange({ rules: removeAt(value.rules, index) })
              : undefined
          }
        >
          <TextField
            columnOptions
            label="字段 ID"
            value={rule.columnId}
            onChange={(columnId) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, columnId }),
              })
            }
          />
          <SelectField
            label="目标类型"
            value={rule.targetType}
            options={[
              ['string', '文本'],
              ['number', '数字'],
              ['boolean', '布尔值'],
              ['date', '日期'],
              ['datetime', '日期时间'],
            ]}
            onChange={(targetType) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, targetType }),
              })
            }
          />
          <SelectField
            label="失败处理"
            value={rule.onError}
            options={[
              ['fail', '终止运行'],
              ['null', '设为空值'],
              ['keep-original', '保留原值'],
            ]}
            onChange={(onError) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, onError }),
              })
            }
          />
        </RuleItem>
      ))}
    </RuleList>
  );
}

function DeriveEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['transform.derive']>) {
  return (
    <FormFields>
      <TextField
        label="新字段名"
        value={value.outputName}
        onChange={(outputName) => onChange({ ...value, outputName })}
      />
      <ExpressionEditor
        label="计算表达式"
        value={value.expression}
        onChange={(expression) => onChange({ ...value, expression })}
      />
    </FormFields>
  );
}

function SortEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['transform.sort']>) {
  return (
    <RuleList
      label="排序规则"
      onAdd={() =>
        onChange({
          rules: [
            ...value.rules,
            { columnId: 'column-1', direction: 'asc', nulls: 'last' },
          ],
        })
      }
    >
      {value.rules.map((rule, index) => (
        <RuleItem
          key={index}
          label={`优先级 ${index + 1}`}
          onRemove={
            value.rules.length > 1
              ? () => onChange({ rules: removeAt(value.rules, index) })
              : undefined
          }
        >
          <TextField
            columnOptions
            label="字段 ID"
            value={rule.columnId}
            onChange={(columnId) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, columnId }),
              })
            }
          />
          <SelectField
            label="方向"
            value={rule.direction}
            options={[
              ['asc', '升序'],
              ['desc', '降序'],
            ]}
            onChange={(direction) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, direction }),
              })
            }
          />
          <SelectField
            label="空值位置"
            value={rule.nulls}
            options={[
              ['first', '最前'],
              ['last', '最后'],
            ]}
            onChange={(nulls) =>
              onChange({
                rules: replaceAt(value.rules, index, { ...rule, nulls }),
              })
            }
          />
        </RuleItem>
      ))}
    </RuleList>
  );
}

function DeduplicateEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['transform.deduplicate']>) {
  return (
    <FormFields>
      <CommaListField
        label="判重字段 ID"
        values={value.columnIds}
        onChange={(columnIds) => onChange({ ...value, columnIds })}
      />
      <SelectField
        label="保留记录"
        value={value.keep}
        options={[
          ['first', '第一条'],
          ['last', '最后一条'],
        ]}
        onChange={(keep) => onChange({ ...value, keep })}
      />
    </FormFields>
  );
}

function GroupEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['aggregate.group']>) {
  return (
    <FormFields>
      <CommaListField
        label="分组字段 ID"
        values={value.groupBy}
        allowEmpty
        onChange={(groupBy) => onChange({ ...value, groupBy })}
      />
      <RuleList
        label="统计规则"
        onAdd={() =>
          onChange({
            ...value,
            aggregates: [
              ...value.aggregates,
              { operation: 'count', outputName: 'Count' },
            ],
          })
        }
      >
        {value.aggregates.map((aggregate, index) => (
          <RuleItem
            key={index}
            label={`统计 ${index + 1}`}
            onRemove={
              value.aggregates.length > 1
                ? () =>
                    onChange({
                      ...value,
                      aggregates: removeAt(value.aggregates, index),
                    })
                : undefined
            }
          >
            <SelectField
              label="统计方式"
              value={aggregate.operation}
              options={[
                ['count', '计数'],
                ['sum', '求和'],
                ['avg', '平均值'],
                ['min', '最小值'],
                ['max', '最大值'],
              ]}
              onChange={(operation) =>
                onChange({
                  ...value,
                  aggregates: replaceAt(value.aggregates, index, {
                    ...aggregate,
                    operation,
                    ...(operation === 'count'
                      ? { columnId: undefined }
                      : { columnId: aggregate.columnId ?? 'column-1' }),
                  }),
                })
              }
            />
            {aggregate.operation !== 'count' && (
              <TextField
                columnOptions
                label="统计字段 ID"
                value={aggregate.columnId ?? ''}
                onChange={(columnId) =>
                  onChange({
                    ...value,
                    aggregates: replaceAt(value.aggregates, index, {
                      ...aggregate,
                      columnId,
                    }),
                  })
                }
              />
            )}
            <TextField
              label="输出字段名"
              value={aggregate.outputName}
              onChange={(outputName) =>
                onChange({
                  ...value,
                  aggregates: replaceAt(value.aggregates, index, {
                    ...aggregate,
                    outputName,
                  }),
                })
              }
            />
          </RuleItem>
        ))}
      </RuleList>
    </FormFields>
  );
}

function JoinEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['combine.join']>) {
  return (
    <FormFields>
      <SelectField
        label="关联方式"
        value={value.joinType}
        options={[
          ['inner', '内连接'],
          ['left', '左连接'],
        ]}
        onChange={(joinType) => onChange({ ...value, joinType })}
      />
      <RuleList
        label="关联键"
        onAdd={() =>
          onChange({
            ...value,
            leftKeys: [...value.leftKeys, 'column-1'],
            rightKeys: [...value.rightKeys, 'column-1'],
          })
        }
      >
        {value.leftKeys.map((leftKey, index) => (
          <RuleItem
            key={index}
            label={`键 ${index + 1}`}
            onRemove={
              value.leftKeys.length > 1
                ? () =>
                    onChange({
                      ...value,
                      leftKeys: removeAt(value.leftKeys, index),
                      rightKeys: removeAt(value.rightKeys, index),
                    })
                : undefined
            }
          >
            <TextField
              columnOptions
              label="左侧字段 ID"
              value={leftKey}
              onChange={(next) =>
                onChange({
                  ...value,
                  leftKeys: replaceAt(value.leftKeys, index, next),
                })
              }
            />
            <TextField
              columnOptions
              label="右侧字段 ID"
              value={value.rightKeys[index] ?? ''}
              onChange={(next) =>
                onChange({
                  ...value,
                  rightKeys: replaceAt(value.rightKeys, index, next),
                })
              }
            />
          </RuleItem>
        ))}
      </RuleList>
      <TextField
        label="右侧字段前缀"
        value={value.rightColumnPrefix}
        onChange={(rightColumnPrefix) =>
          onChange({ ...value, rightColumnPrefix })
        }
      />
    </FormFields>
  );
}

function CsvOutputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['output.csv']>) {
  return (
    <FormFields>
      <TextField
        label="文件名"
        value={value.fileName}
        onChange={(fileName) => onChange({ ...value, fileName })}
      />
      <SelectField
        label="分隔符"
        value={value.delimiter}
        options={[
          [',', '逗号'],
          [';', '分号'],
          ['\t', '制表符'],
          ['|', '竖线'],
        ]}
        onChange={(delimiter) => onChange({ ...value, delimiter })}
      />
      <CheckboxField
        label="包含字段名"
        checked={value.includeHeader}
        onChange={(includeHeader) => onChange({ ...value, includeHeader })}
      />
    </FormFields>
  );
}

function JsonOutputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['output.json']>) {
  return (
    <FormFields>
      <TextField
        label="文件名"
        value={value.fileName}
        onChange={(fileName) => onChange({ ...value, fileName })}
      />
      <CheckboxField
        label="格式化输出"
        checked={value.pretty}
        onChange={(pretty) => onChange({ ...value, pretty })}
      />
    </FormFields>
  );
}

function XlsxOutputEditor({
  value,
  onChange,
}: EditorProps<NodeConfigByKind['output.xlsx']>) {
  return (
    <FormFields>
      <TextField
        label="文件名"
        value={value.fileName}
        onChange={(fileName) => onChange({ ...value, fileName })}
      />
      <TextField
        label="工作表名称"
        value={value.sheetName}
        onChange={(sheetName) => onChange({ ...value, sheetName })}
      />
    </FormFields>
  );
}

interface EditorProps<T> {
  value: T;
  onChange: ChangeHandler;
}

function FormFields({ children }: { children: ReactNode }) {
  return <div className="visual-config-fields">{children}</div>;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  columnOptions = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  columnOptions?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        list={columnOptions ? 'pipeline-column-options' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function CommaListField({
  label,
  values,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  allowEmpty?: boolean;
}) {
  return (
    <TextField
      label={label}
      value={values.join(', ')}
      placeholder={allowEmpty ? '留空表示不分组' : '多个字段用逗号分隔'}
      onChange={(text) =>
        onChange(
          text
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

function RuleList({
  label,
  onAdd,
  children,
}: {
  label: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rule-list">
      <header>
        <h3>{label}</h3>
        <button
          className="icon-button"
          type="button"
          title={`添加${label}`}
          aria-label={`添加${label}`}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" size={15} />
        </button>
      </header>
      {children}
    </section>
  );
}

function RuleItem({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset className="rule-item">
      <legend>{label}</legend>
      {onRemove && (
        <button
          className="icon-button rule-remove"
          type="button"
          title={`删除${label}`}
          aria-label={`删除${label}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
      )}
      {children}
    </fieldset>
  );
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}
