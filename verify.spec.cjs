const { test } = require('@playwright/test');

test('popup', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5176');
  await page.waitForTimeout(6000);
  // Get position of first marker div icon
  const marker = page.locator('div.leaflet-marker-icon').first();
  const box = await marker.boundingBox();
  console.log('Marker box:', JSON.stringify(box));
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/map-popup.png' });
  // Also capture popup content
  const popup = await page.locator('.leaflet-popup-content').textContent().catch(() => 'no popup');
  console.log('Popup text:', popup);
});
