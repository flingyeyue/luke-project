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
  await page.getByRole('button', { name: /筛选 transform\.filter/u }).click();
  await page.getByRole('button', { name: /CSV 输出 output\.csv/u }).click();
  await page.getByRole('button', { name: '运行' }).click();

  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  await expect(page.getByText('10 行', { exact: true })).toBeVisible();
  await expect(page.getByText('已加载 10 行')).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'order_id' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1010' })).toBeVisible();
  await page.getByRole('tab', { name: '字段' }).click();
  await expect(page.getByText('amount')).toBeVisible();
  await expect(page.getByText('number', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pipeline-output.csv');
  expect(await download.createReadStream().then(readStream)).toContain(
    'ORD-1010',
  );
});

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
