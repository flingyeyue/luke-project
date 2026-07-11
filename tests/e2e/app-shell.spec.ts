import { expect, test } from '@playwright/test';

test('renders the workspace shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('数据流水线');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('节点库')).toBeVisible();
  await expect(page.getByLabel('流水线设计器')).toBeVisible();
  await expect(page.getByLabel('节点配置')).toBeVisible();
  await expect(page.getByRole('region', { name: '运行数据' })).toBeVisible();
});
