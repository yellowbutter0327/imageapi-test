import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('search, pagination, URL restoration and image preview', async ({
  page,
  isMobile,
}, testInfo) => {
  const count = isMobile ? 12 : 28;
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/search?')) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const cards = page
    .getByRole('list', { name: '이미지 검색 결과' })
    .getByRole('listitem');
  await expect(cards).toHaveCount(count);
  await expect(page.getByText(/API 키 없이 둘러보는 샘플/)).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]!).searchParams.get('pageSize')).toBe(
    String(count),
  );
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(cards).toHaveCount(count);
  await page.getByRole('searchbox', { name: '이미지 검색어' }).fill('포스터');
  await page.getByRole('searchbox', { name: '이미지 검색어' }).press('Enter');
  await expect(page).toHaveURL(/page=1/);
  await expect(cards).toHaveCount(isMobile ? 12 : 24);
  await page.goBack();
  await expect(
    page.getByRole('searchbox', { name: '이미지 검색어' }),
  ).toHaveValue('티셔츠');
  await page.reload();
  await expect(
    page.getByRole('button', { name: '2페이지', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const first = page.getByRole('button', { name: /상세 보기/ }).first();
  await first.focus();
  await first.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(first).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('14px "Pretendard Variable"', '이미지');
    }),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('gallery.png'),
    fullPage: true,
  });
});

test('responsive sizes preserve the anchor and avoid requests inside a breakpoint', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop browser verifies window resizing.');
  await page.setViewportSize({ width: 1199, height: 900 });
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/search?')) requests += 1;
  });
  await page.goto('/?q=티셔츠&sort=sim&page=3&pageSize=12');
  const cards = page
    .getByRole('list', { name: '이미지 검색 결과' })
    .getByRole('listitem');
  await expect(cards).toHaveCount(12);
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(cards).toHaveCount(20);
  await expect(page).toHaveURL(/page=2&pageSize=20/);
  const afterBoundary = requests;
  await page.setViewportSize({ width: 1439, height: 900 });
  await expect(cards).toHaveCount(20);
  // Let matchMedia and React flush; no real-time delay or network dependency.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  expect(requests).toBe(afterBoundary);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(cards).toHaveCount(28);
  await expect(page).toHaveURL(/page=1&pageSize=28/);
  await page.setViewportSize({ width: 1900, height: 900 });
  await expect(cards).toHaveCount(40);
  await expect(page).toHaveURL(/page=1&pageSize=40/);
  expect(requests).toBe(4);
});

test('empty results and a blank query have clear behavior', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByRole('searchbox', { name: '이미지 검색어' });
  await expect(
    page.getByRole('list', { name: '이미지 검색 결과' }),
  ).toBeVisible();
  await input.fill('   ');
  await expect(
    page.getByRole('button', { name: '검색', exact: true }),
  ).toBeDisabled();
  await input.fill('없는검색어');
  await input.press('Enter');
  await expect(
    page.getByRole('heading', { name: '검색 결과가 없어요.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: '검색 결과 페이지' }),
  ).toHaveCount(0);
});

test('a maximum-length query keeps the result controls inside the viewport', async ({
  page,
}) => {
  const query = 'a'.repeat(100);
  await page.goto(`/?q=${query}`);
  await expect(
    page.getByRole('heading', { name: '검색 결과가 없어요.' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const sort = page.getByRole('combobox');
  await expect(sort).toBeInViewport({ ratio: 1 });
  await sort.selectOption('date');
  await expect(page).toHaveURL(/sort=date/);
});

test('page and dialog pass automated accessibility checks', async ({
  page,
}) => {
  await page.goto('/');
  const first = page.getByRole('button', { name: /상세 보기/ }).first();
  await expect(first).toBeVisible();
  const analyze = () =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
  expect((await analyze()).violations).toEqual([]);
  await first.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await analyze()).violations).toEqual([]);
});

test('API validation and demo mode work through the real server', async ({
  request,
}) => {
  const invalid = await request.get('/api/search?q=x&pageSize=24');
  expect(invalid.status()).toBe(400);
  const valid = await request.get('/api/search?q=티셔츠&pageSize=40');
  expect(valid.ok()).toBe(true);
  expect((await valid.json()).items).toHaveLength(40);
  expect(valid.headers()['cache-control']).toBe('no-store');
});
