import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(
  new URL(
    '../../packages/test-fixtures/data/orders-small.csv',
    import.meta.url,
  ),
);

test('imports a CSV when crypto.randomUUID is unavailable', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
  });

  await page.goto('/');
  await page.getByLabel('选择 CSV').setInputFiles(fixture);

  await expect(page.getByText('orders-small.csv · 523 B')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('imports a CSV through the worker and previews its data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('选择 CSV').setInputFiles(fixture);

  await expect(page.getByText('orders-small.csv · 523 B')).toBeVisible();
  await page.getByRole('button', { name: /筛选 transform\.filter/u }).click();
  await page.getByLabel('筛选条件类型').selectOption('binary');
  await page.getByLabel('筛选条件左值类型').selectOption('column');
  await page.getByLabel('筛选条件左值字段 ID').fill('status-4');
  await page.getByLabel('筛选条件右值值', { exact: true }).fill('completed');
  await page.getByRole('button', { name: '应用' }).click();
  await expect(page.getByText('配置已应用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /CSV 输出 output\.csv/u }).click();
  await page.getByRole('button', { name: '运行' }).click();

  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  await expect(page.getByText('7 行', { exact: true })).toBeVisible();
  await expect(page.getByText('已加载 7 行')).toBeVisible();
  const tableWidths = await page.locator('.virtual-table').evaluate((table) => {
    const header = table.querySelector('.virtual-table__header');
    const row = table.querySelector('.virtual-table__row');
    const width = (element: Element | null) =>
      element?.getBoundingClientRect().width ?? 0;
    return {
      header: width(header),
      row: width(row),
      headerCell: width(header?.firstElementChild ?? null),
      rowCell: width(row?.firstElementChild ?? null),
    };
  });
  expect(tableWidths.row).toBe(tableWidths.header);
  expect(tableWidths.rowCell).toBe(tableWidths.headerCell);
  await expect(
    page.getByRole('columnheader', { name: 'order_id' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ORD-1010' })).toBeVisible();
  await page.getByRole('tab', { name: '字段' }).click();
  const runtimePanel = page.getByLabel('运行数据', { exact: true });
  await expect(runtimePanel.getByText('amount', { exact: true })).toBeVisible();
  await expect(runtimePanel.getByText('number', { exact: true })).toBeVisible();

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
