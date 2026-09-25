import { expect, test } from '@playwright/test';

test('initial transfer stays within measured budgets and preview loads on demand', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Transfer budget uses a fixed Chromium viewport.',
  );
  await page.goto('/');
  const first = page.getByRole('button', { name: /상세 보기/ }).first();
  await expect(first).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const initial = await page.evaluate(() => {
    const entries = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
    const bytes = (pattern: RegExp) =>
      entries
        .filter((entry) => pattern.test(entry.name))
        .reduce((sum, entry) => sum + entry.encodedBodySize, 0);
    return {
      js: bytes(/\.js(?:\?|$)/),
      css: bytes(/\.css(?:\?|$)/),
      fonts: bytes(/\.woff2?(?:\?|$)/),
      api: entries.filter((entry) => entry.name.includes('/api/search?'))
        .length,
    };
  });
  expect(initial.js).toBeGreaterThan(0);
  expect(initial.js).toBeLessThanOrEqual(200_000);
  expect(initial.css).toBeLessThanOrEqual(25_000);
  expect(initial.fonts).toBeLessThanOrEqual(350_000);
  expect(initial.api).toBe(1);
  await first.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const withPreview = await page.evaluate(() =>
    (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((entry) => /\.js(?:\?|$)/.test(entry.name))
      .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
  );
  expect(withPreview).toBeGreaterThan(initial.js);
});
