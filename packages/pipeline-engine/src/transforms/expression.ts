import type { CellValue, DataBatch, Expression } from '@luke/contracts';

export class ExpressionEvaluationError extends Error {}

export interface ExpressionContext {
  batch: DataBatch;
  row: CellValue[];
}

export function evaluateExpression(
  expression: Expression,
  context: ExpressionContext,
): CellValue {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'column': {
      const index = context.batch.schema.columns.findIndex(
        (column) => column.id === expression.columnId,
      );
      if (index < 0) {
        throw new ExpressionEvaluationError(
          `Column ${expression.columnId} does not exist.`,
        );
      }
      return context.row[index] ?? null;
    }
    case 'unary': {
      const operand = evaluateExpression(expression.operand, context);
      if (expression.operator === 'is-null') return operand === null;
      if (typeof operand !== 'boolean') {
        throw new ExpressionEvaluationError(
          'The not operator requires a boolean.',
        );
      }
      return !operand;
    }
    case 'binary':
      return evaluateBinary(expression, context);
  }
}

function evaluateBinary(
  expression: Extract<Expression, { type: 'binary' }>,
  context: ExpressionContext,
): CellValue {
  const left = evaluateExpression(expression.left, context);
  if (expression.operator === 'and') {
    if (typeof left !== 'boolean') return booleanError('and');
    return left
      ? requireBoolean(evaluateExpression(expression.right, context), 'and')
      : false;
  }
  if (expression.operator === 'or') {
    if (typeof left !== 'boolean') return booleanError('or');
    return left
      ? true
      : requireBoolean(evaluateExpression(expression.right, context), 'or');
  }

  const right = evaluateExpression(expression.right, context);
  switch (expression.operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compare(left, right, expression.operator);
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      return calculate(left, right, expression.operator);
  }
}

function requireBoolean(value: CellValue, operator: string): boolean {
  if (typeof value !== 'boolean') return booleanError(operator);
  return value;
}

function booleanError(operator: string): never {
  throw new ExpressionEvaluationError(
    `The ${operator} operator requires boolean operands.`,
  );
}

function compare(
  left: CellValue,
  right: CellValue,
  operator: 'gt' | 'gte' | 'lt' | 'lte',
): boolean {
  if (
    (typeof left !== 'number' && typeof left !== 'string') ||
    typeof left !== typeof right
  ) {
    throw new ExpressionEvaluationError(
      `The ${operator} operator requires two numbers or two strings.`,
    );
  }
  const rightValue = right as number | string;
  if (operator === 'gt') return left > rightValue;
  if (operator === 'gte') return left >= rightValue;
  if (operator === 'lt') return left < rightValue;
  return left <= rightValue;
}

function calculate(
  left: CellValue,
  right: CellValue,
  operator: 'add' | 'subtract' | 'multiply' | 'divide',
): number {
  if (typeof left !== 'number' || typeof right !== 'number') {
    throw new ExpressionEvaluationError(
      `The ${operator} operator requires numeric operands.`,
    );
  }
  if (operator === 'divide' && right === 0) {
    throw new ExpressionEvaluationError('Division by zero is not allowed.');
  }
  const result =
    operator === 'add'
      ? left + right
      : operator === 'subtract'
        ? left - right
        : operator === 'multiply'
          ? left * right
          : left / right;
  if (!Number.isFinite(result)) {
    throw new ExpressionEvaluationError('The calculation is not finite.');
  }
  return result;
}
