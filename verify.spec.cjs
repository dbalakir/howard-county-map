const { test } = require('@playwright/test');

test('park layers', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5176');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/map-parks-before.png' });

  // Toggle on all 6 park layers
  for (const id of ['forestCoverToggle','forestEasementToggle','hocoOpenSpaceToggle','hocoParksToggle','nonHocoParksToggle','preservationToggle']) {
    await page.click(`#${id}`);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/map-parks-after.png' });
});
