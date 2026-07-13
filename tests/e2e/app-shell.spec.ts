import { expect, test } from '@playwright/test';

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
