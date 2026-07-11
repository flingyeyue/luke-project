import { expect, test } from '@playwright/test';

test('renders the workspace shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('数据流水线');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('节点库')).toBeVisible();
  await expect(page.getByLabel('流水线画布')).toBeVisible();
  await expect(page.getByLabel('配置面板')).toBeVisible();
  await expect(page.getByLabel('数据预览')).toBeVisible();
});
