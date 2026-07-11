import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(
  new URL(
    '../../packages/test-fixtures/data/orders-small.csv',
    import.meta.url,
  ),
);

test('imports a CSV through the worker and previews its data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('选择 CSV').setInputFiles(fixture);

  await expect(page.getByText('orders-small.csv · 523 B')).toBeVisible();
  await page.getByRole('button', { name: '运行' }).click();

  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  await expect(page.getByText('10 行')).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'order_id' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1010' })).toBeVisible();
  await page.getByRole('tab', { name: '字段' }).click();
  await expect(page.getByText('amount')).toBeVisible();
  await expect(page.getByText('number', { exact: true })).toBeVisible();
});
