import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(
  new URL(
    '../../packages/test-fixtures/data/orders-small.csv',
    import.meta.url,
  ),
);

test('uploads and reads the synthetic CSV fixture', async ({ page }) => {
  await page.setContent('<input aria-label="CSV source" type="file" />');
  const input = page.getByLabel('CSV source');

  await input.setInputFiles(fixture);

  const fileInfo = await input.evaluate((element: HTMLInputElement) => {
    const file = element.files?.[0];
    if (!file) return null;
    return file.text().then((text) => ({ name: file.name, text }));
  });
  expect(fileInfo?.name).toBe('orders-small.csv');
  expect(fileInfo?.text).toContain('order_id,order_date,region');
  expect(fileInfo?.text).toContain('ORD-1010');
});
