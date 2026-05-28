const { test } = require('@playwright/test');

test('highlight zoomed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5176');
  await page.waitForTimeout(6000);

  await page.evaluate(() => window._map.setView([39.2878, -76.8885], 18));
  await page.waitForTimeout(4000);

  const marker = page.locator('div.leaflet-marker-icon').first();
  const box = await marker.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/highlight-final.png' });
});
