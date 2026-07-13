import { expect, test, type Locator } from '@playwright/test';

test('renders the workspace shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('数据流水线');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('项目文件')).toContainText('已保存');
  await expect(page.getByLabel('节点库')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /选择与重命名/u }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /分组统计/u })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /关联 combine\.join/u }),
  ).toBeVisible();
  await expect(page.getByLabel('流水线设计器')).toBeVisible();
  await expect(page.getByLabel('节点配置')).toBeVisible();
  await expect(page.getByRole('region', { name: '运行数据' })).toBeVisible();
});

test('creates a calculated field with visible arithmetic controls', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /计算字段 transform\.derive/u })
    .click();

  await expect(page.getByLabel('计算表达式类型')).toHaveValue('binary');
  await expect(page.getByLabel('计算表达式运算符')).toHaveValue('add');
  await page.getByLabel('计算表达式运算符').selectOption('multiply');
  await page.getByRole('button', { name: '应用', exact: true }).click();
  await page.getByRole('button', { name: 'JSON', exact: true }).click();

  await expect(page.getByLabel('配置 JSON')).toHaveValue(
    /"operator": "multiply"/u,
  );
});

test('exposes the primary options for every processing node', async ({
  page,
}) => {
  await page.goto('/');
  const addNode = async (kind: string) =>
    page.locator('.node-template').filter({ hasText: kind }).click();

  await addNode('transform.cast');
  expect(await optionValues(page.getByLabel('目标类型'))).toEqual([
    'string',
    'number',
    'boolean',
    'date',
    'datetime',
  ]);
  expect(await optionValues(page.getByLabel('失败处理'))).toEqual([
    'fail',
    'null',
    'keep-original',
  ]);

  await addNode('transform.filter');
  await expect(page.getByLabel('筛选条件类型')).toHaveValue('binary');
  await expect(page.getByLabel('筛选条件运算符')).toHaveValue('eq');
  expect(await optionValues(page.getByLabel('筛选条件运算符'))).toEqual([
    'add',
    'subtract',
    'multiply',
    'divide',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'and',
    'or',
  ]);

  await addNode('transform.sort');
  expect(await optionValues(page.getByLabel('方向'))).toEqual(['asc', 'desc']);
  expect(await optionValues(page.getByLabel('空值位置'))).toEqual([
    'first',
    'last',
  ]);

  await addNode('transform.deduplicate');
  expect(await optionValues(page.getByLabel('保留记录'))).toEqual([
    'first',
    'last',
  ]);

  await addNode('aggregate.group');
  expect(await optionValues(page.getByLabel('统计方式'))).toEqual([
    'count',
    'sum',
    'avg',
    'min',
    'max',
  ]);

  await addNode('combine.join');
  expect(await optionValues(page.getByLabel('关联方式'))).toEqual([
    'inner',
    'left',
  ]);
});

async function optionValues(locator: Locator) {
  return locator
    .locator('option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
}
