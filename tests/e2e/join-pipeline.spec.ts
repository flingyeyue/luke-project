import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const orders = fileURLToPath(
  new URL(
    '../../packages/test-fixtures/data/orders-small.csv',
    import.meta.url,
  ),
);

test('builds and runs a two-source order and region join', async ({ page }) => {
  await page.goto('/');
  const fileInput = page.getByLabel('选择 CSV');
  await fileInput.setInputFiles(orders);

  await page.getByRole('button', { name: /CSV 输入 input\.csv/u }).click();
  await fileInput.setInputFiles({
    name: 'regions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'region,owner',
        'north,Morgan Lee',
        'south,Taylor Kim',
        'east,Jordan Singh',
        'west,Casey Chen',
      ].join('\n'),
    ),
  });

  await page.getByRole('button', { name: /关联 combine\.join/u }).click();
  await expect(page.getByLabel('节点配置')).toContainText('combine.join');
  await page.getByLabel('左侧字段 ID').fill('region-3');
  await page.getByLabel('右侧字段 ID').fill('region-1');
  await page.getByLabel('右侧字段前缀').fill('region.');
  await page.getByRole('button', { name: '应用' }).click();
  await expect(page.getByText('配置已应用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /CSV 输出 output\.csv/u }).click();

  await page.getByRole('button', { name: '运行' }).click();
  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  await expect(page.getByText('10 行', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'owner' })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Morgan Lee' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Taylor Kim' }).first(),
  ).toBeVisible();
});
