const { test, expect } = require('@playwright/test');

test('popup shows correctly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5176');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/map-loaded.png' });

  // Click in the dense cluster
  await page.mouse.click(640, 430);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/map-popup.png' });
});
