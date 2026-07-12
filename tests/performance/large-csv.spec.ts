import { expect, test, type CDPSession } from '@playwright/test';

const rowCount = 100_000;

test('imports and previews 100,000 CSV rows within the browser budget', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const durations: number[] = [];
    Object.defineProperty(window, '__lukeLongTasks', { value: durations });
    new PerformanceObserver((list) => {
      durations.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'longtask', buffered: true });
  });

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await page.goto('/');

  const csv = createCsv(rowCount);
  const heapBefore = await readMetric(client, 'JSHeapUsedSize');
  const startedAt = performance.now();

  await page.getByLabel('选择 CSV').setInputFiles({
    name: 'orders-100k.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: '运行' }).click();
  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  await expect(page.getByText('100000 行', { exact: true })).toBeVisible();
  await expect(page.getByText('已加载 1000 行')).toBeVisible();

  const elapsedMs = performance.now() - startedAt;
  const heapAfter = await readMetric(client, 'JSHeapUsedSize');
  const longTasks = await page.evaluate(
    () =>
      (window as typeof window & { readonly __lukeLongTasks: number[] })
        .__lukeLongTasks,
  );
  const result = {
    rows: rowCount,
    csvBytes: Buffer.byteLength(csv),
    elapsedMs: Math.round(elapsedMs),
    jsHeapBeforeBytes: Math.round(heapBefore),
    jsHeapAfterBytes: Math.round(heapAfter),
    jsHeapDeltaBytes: Math.round(heapAfter - heapBefore),
    longTaskCount: longTasks.length,
    longestTaskMs: Math.round(Math.max(0, ...longTasks)),
    totalLongTaskMs: Math.round(longTasks.reduce((sum, item) => sum + item, 0)),
  };

  console.log(`PERFORMANCE_RESULT ${JSON.stringify(result)}`);
  expect(elapsedMs).toBeLessThan(30_000);
  expect(heapAfter - heapBefore).toBeLessThan(512 * 1024 * 1024);
});

function createCsv(rows: number): string {
  const lines = new Array<string>(rows + 1);
  lines[0] = 'order_id,region,category,quantity,amount,active';
  for (let index = 1; index <= rows; index += 1) {
    lines[index] =
      `ORD-${String(index).padStart(6, '0')},${index % 4},${index % 12},${(index % 9) + 1},${(index * 1.17).toFixed(2)},${index % 2 === 0}`;
  }
  return lines.join('\n');
}

async function readMetric(client: CDPSession, name: string): Promise<number> {
  const { metrics } = await client.send('Performance.getMetrics');
  return metrics.find((metric) => metric.name === name)?.value ?? 0;
}
