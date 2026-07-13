import type { Expression } from '@luke/contracts';

interface ExpressionEditorProps {
  label: string;
  value: Expression;
  onChange: (value: Expression) => void;
}

const expressionTypes: { value: Expression['type']; label: string }[] = [
  { value: 'literal', label: '固定值' },
  { value: 'column', label: '字段' },
  { value: 'unary', label: '单目运算' },
  { value: 'binary', label: '双目运算' },
];

const binaryOperators = [
  ['eq', '等于'],
  ['neq', '不等于'],
  ['gt', '大于'],
  ['gte', '大于等于'],
  ['lt', '小于'],
  ['lte', '小于等于'],
  ['and', '并且'],
  ['or', '或者'],
  ['add', '加'],
  ['subtract', '减'],
  ['multiply', '乘'],
  ['divide', '除'],
] as const;

export function ExpressionEditor({
  label,
  value,
  onChange,
}: ExpressionEditorProps) {
  return (
    <fieldset className="expression-editor">
      <legend>{label}</legend>
      <label>
        表达式类型
        <select
          aria-label={`${label}类型`}
          onChange={(event) =>
            onChange(
              defaultExpression(event.target.value as Expression['type']),
            )
          }
          value={value.type}
        >
          {expressionTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {value.type === 'literal' && (
        <LiteralEditor label={label} value={value} onChange={onChange} />
      )}
      {value.type === 'column' && (
        <label>
          字段 ID
          <input
            aria-label={`${label}字段 ID`}
            list="pipeline-column-options"
            onChange={(event) =>
              onChange({ type: 'column', columnId: event.target.value })
            }
            placeholder="例如 amount-5"
            value={value.columnId}
          />
        </label>
      )}
      {value.type === 'unary' && (
        <>
          <label>
            运算符
            <select
              aria-label={`${label}运算符`}
              onChange={(event) =>
                onChange({
                  ...value,
                  operator: event.target.value as typeof value.operator,
                })
              }
              value={value.operator}
            >
              <option value="not">取反</option>
              <option value="is-null">为空</option>
            </select>
          </label>
          <ExpressionEditor
            label={`${label}操作数`}
            onChange={(operand) => onChange({ ...value, operand })}
            value={value.operand}
          />
        </>
      )}
      {value.type === 'binary' && (
        <>
          <label>
            运算符
            <select
              aria-label={`${label}运算符`}
              onChange={(event) =>
                onChange({
                  ...value,
                  operator: event.target.value as typeof value.operator,
                })
              }
              value={value.operator}
            >
              {binaryOperators.map(([operator, operatorLabel]) => (
                <option key={operator} value={operator}>
                  {operatorLabel}
                </option>
              ))}
            </select>
          </label>
          <ExpressionEditor
            label={`${label}左值`}
            onChange={(left) => onChange({ ...value, left })}
            value={value.left}
          />
          <ExpressionEditor
            label={`${label}右值`}
            onChange={(right) => onChange({ ...value, right })}
            value={value.right}
          />
        </>
      )}
    </fieldset>
  );
}

function LiteralEditor({
  label,
  value,
  onChange,
}: ExpressionEditorProps & {
  value: Extract<Expression, { type: 'literal' }>;
}) {
  const literalType =
    value.value === null ? 'null' : (typeof value.value as LiteralType);

  return (
    <>
      <label>
        值类型
        <select
          aria-label={`${label}值类型`}
          onChange={(event) =>
            onChange({
              type: 'literal',
              value: defaultLiteral(event.target.value as LiteralType),
            })
          }
          value={literalType}
        >
          <option value="string">文本</option>
          <option value="number">数字</option>
          <option value="boolean">布尔值</option>
          <option value="null">空值</option>
        </select>
      </label>
      {typeof value.value === 'string' && (
        <label>
          值
          <input
            aria-label={`${label}值`}
            onChange={(event) =>
              onChange({ type: 'literal', value: event.target.value })
            }
            value={value.value}
          />
        </label>
      )}
      {typeof value.value === 'number' && (
        <label>
          值
          <input
            aria-label={`${label}值`}
            onChange={(event) =>
              onChange({ type: 'literal', value: event.target.valueAsNumber })
            }
            type="number"
            value={value.value}
          />
        </label>
      )}
      {typeof value.value === 'boolean' && (
        <label>
          值
          <select
            aria-label={`${label}值`}
            onChange={(event) =>
              onChange({
                type: 'literal',
                value: event.target.value === 'true',
              })
            }
            value={String(value.value)}
          >
            <option value="true">真</option>
            <option value="false">假</option>
          </select>
        </label>
      )}
    </>
  );
}

type LiteralType = 'string' | 'number' | 'boolean' | 'null';

function defaultLiteral(type: LiteralType): string | number | boolean | null {
  if (type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'null') return null;
  return '';
}

function defaultExpression(type: Expression['type']): Expression {
  if (type === 'column') return { type: 'column', columnId: 'column-1' };
  if (type === 'unary') {
    return {
      type: 'unary',
      operator: 'is-null',
      operand: { type: 'column', columnId: 'column-1' },
    };
  }
  if (type === 'binary') {
    return {
      type: 'binary',
      operator: 'eq',
      left: { type: 'column', columnId: 'column-1' },
      right: { type: 'literal', value: '' },
    };
  }
  return { type: 'literal', value: '' };
}
