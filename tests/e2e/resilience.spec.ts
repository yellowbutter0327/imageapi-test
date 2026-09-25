import { expect, test, type Page } from '@playwright/test';

function fixture(q: string, size = 12) {
  return {
    mode: 'demo',
    total: 120,
    items: Array.from({ length: size }, (_, i) => ({
      id: `${q}-${i}`,
      title: `${q} 이미지 ${i + 1}`,
      thumbnail: `/demo/${(i % 18) + 1}.svg`,
      original: `/demo/${(i % 18) + 1}.svg`,
      width: 480,
      height: 480,
    })),
  };
}
async function search(page: Page, q: string) {
  const input = page.getByRole('searchbox', { name: '이미지 검색어' });
  await input.fill(q);
  await input.press('Enter');
}
const cards = (page: Page) => page.getByRole('button', { name: /상세 보기/ });

test('keyboard pagination keeps focus on results while the next page loads', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/search?**', async (route) => {
    const url = new URL(route.request().url());
    const currentPage = url.searchParams.get('page');
    if (currentPage === '2') await pending;
    await route.fulfill({ json: fixture(`page-${currentPage}`) });
  });
  await page.goto('/');
  const next = page.getByRole('button', { name: '다음 페이지' });
  await expect(next).toBeEnabled();
  await next.focus();
  await next.press('Enter');
  const results = page.getByRole('region', { name: '검색 결과', exact: true });
  try {
    await expect(results).toHaveAttribute('aria-busy', 'true');
    await expect(next).toHaveCount(0);
    await expect(results).toBeFocused();
  } finally {
    release();
  }
  await expect(cards(page).first()).toHaveAccessibleName(
    'page-2 이미지 1 상세 보기',
  );
  await expect(results).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox')).toBeFocused();
});

test('a late previous response never replaces the latest search', async ({
  page,
}) => {
  let release!: () => void;
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/search?**', async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q')!;
    if (q === 'slow') await slow;
    await route
      .fulfill({ json: fixture(q, Number(url.searchParams.get('pageSize'))) })
      .catch(() => {});
  });
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  await Promise.all([
    page.waitForRequest(
      (r) => new URL(r.url()).searchParams.get('q') === 'slow',
    ),
    search(page, 'slow'),
  ]);
  await search(page, 'latest');
  await expect(cards(page).first()).toHaveAccessibleName(
    'latest 이미지 1 상세 보기',
  );
  release();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(cards(page).first()).toHaveAccessibleName(
    'latest 이미지 1 상세 보기',
  );
  await expect(page).toHaveURL(/q=latest/);
});

test('resizing during a request sends only the corrected final page', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Resize is covered by desktop engines.');
  await page.setViewportSize({ width: 1199, height: 900 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const conditions: string[] = [];
  await page.route('**/api/search?**', async (route) => {
    const url = new URL(route.request().url());
    conditions.push(
      `${url.searchParams.get('page')}/${url.searchParams.get('pageSize')}`,
    );
    const size = Number(url.searchParams.get('pageSize'));
    if (size === 12) await pending;
    await route.fulfill({ json: fixture(String(size), size) }).catch(() => {});
  });
  await page.goto('/?q=resize&page=3&pageSize=12');
  await expect.poll(() => conditions.length).toBe(1);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect(cards(page)).toHaveCount(40);
  expect(conditions).toEqual(['3/12', '1/40']);
  release();
  await expect(page).toHaveURL(/page=1&pageSize=40/);
});

test('fresh history restores cached results without another request', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/search?')) requests.push(r.url());
  });
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  await search(page, '포스터');
  await expect(cards(page).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('티셔츠');
  await expect(cards(page).first()).toBeVisible();
  expect(requests).toHaveLength(2);
});

test('invalid shared URLs normalize before the first request', async ({
  page,
  isMobile,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/search?')) requests.push(r.url());
  });
  await page.goto('/?q=%20&sort=wrong&page=-2&pageSize=24&extra=1');
  await expect(cards(page)).toHaveCount(isMobile ? 12 : 28);
  expect(requests).toHaveLength(1);
  const params = new URL(requests[0]!).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    q: '티셔츠',
    sort: 'sim',
    page: '1',
    pageSize: String(isMobile ? 12 : 28),
  });
  await expect(page).not.toHaveURL(/extra|wrong/);
});

test('429 pauses searches across tabs and retries after Retry-After', async ({
  page,
  context,
}) => {
  let attempts = 0;
  await context.route('**/api/search?**', async (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 429,
        headers: { 'Retry-After': '3' },
        json: { code: 'RATE_LIMITED' },
      });
    return route.fulfill({ json: fixture('recovered') });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '검색 요청이 많아요.' }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto('/?q=another');
  await expect(
    other.getByRole('heading', { name: '검색 요청이 많아요.' }),
  ).toBeVisible();
  expect(attempts).toBe(1);
  await expect(cards(page).first()).toHaveAccessibleName(
    'recovered 이미지 1 상세 보기',
  );
  await expect(cards(other).first()).toHaveAccessibleName(
    'recovered 이미지 1 상세 보기',
  );
});

test('transient timeout retries once and exposes manual recovery', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/search?**', async (route) => {
    attempts++;
    if (attempts <= 2)
      return route.fulfill({ status: 504, json: { code: 'TIMEOUT' } });
    return route.fulfill({ json: fixture('retry') });
  });
  await page.goto('/');
  await expect(
    page
      .getByRole('region', { name: '검색 결과', exact: true })
      .getByRole('alert'),
  ).toContainText('시간이 초과');
  expect(attempts).toBe(2);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(cards(page).first()).toHaveAccessibleName(
    'retry 이미지 1 상세 보기',
  );
  expect(attempts).toBe(3);
});

test('invalid successful responses are not retried automatically', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/search?**', (route) => {
    attempts++;
    return route.fulfill({
      status: 200,
      body: '{broken',
      contentType: 'application/json',
    });
  });
  await page.goto('/');
  await expect(
    page
      .getByRole('region', { name: '검색 결과', exact: true })
      .getByRole('alert'),
  ).toContainText('검색 결과를 확인할 수 없어요.');
  expect(attempts).toBe(1);
});

test('preview supports arrows, boundaries and focus return after lazy loading', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  const first = cards(page).first();
  await expect(first).toBeVisible();
  await first.focus();
  await first.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '이전 이미지' }),
  ).toBeDisabled();
  const title = await dialog.getByRole('heading').innerText();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading')).not.toHaveText(title);
  await expect(dialog.getByRole('status')).toHaveText(
    `2 / ${isMobile ? 12 : 28}`,
  );
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('heading')).toHaveText(title);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
});

test('a failed image keeps its card size and original link', async ({
  page,
}) => {
  await page.route('**/demo/1.svg', (route) => route.abort());
  await page.goto('/');
  const first = cards(page).first();
  await expect(first).toContainText('이미지를 불러올 수 없어요');
  await first.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('이미지를 불러올 수 없어요');
  await expect(
    dialog.getByRole('link', { name: /원본 이미지 열기/ }),
  ).toHaveAttribute('href', '/demo/1.svg');
});

test('opening a preview loads the original instead of enlarging the thumbnail', async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1440, height: 720 });
  const original = 'https://images.example.test/original.svg';
  let originalRequests = 0;
  await page.route(original, (route) => {
    originalRequests++;
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="purple"/></svg>',
    });
  });
  await page.route('**/api/search?**', (route) => {
    const data = fixture('원본 화질', 1);
    data.items[0]!.title =
      '긴 상품명과 여러 검색어가 포함된 이미지 제목 '.repeat(8);
    data.items[0]!.original = original;
    return route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  expect(originalRequests).toBe(0);
  await cards(page).first().click();
  const image = page.getByRole('dialog').getByRole('img');
  await expect(image).toHaveAttribute('src', original);
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(960);
  await expect(image).toHaveCSS('opacity', '1');
  await expect(
    page.getByRole('link', { name: /원본 이미지 열기/ }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('button', { name: '다음 이미지' }),
  ).toBeInViewport({ ratio: 1 });
});

test('an unavailable original falls back without upscaling and the next image retries its own original', async ({
  page,
}) => {
  const original = 'https://images.example.test/unavailable.svg';
  await page.route(original, (route) => route.abort());
  await page.route('**/demo/1.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="purple"/></svg>',
    }),
  );
  await page.route('**/api/search?**', (route) => {
    const data = fixture('이미지 대체', 3);
    data.items[0]!.original = original;
    return route.fulfill({ json: data });
  });
  await page.goto('/');
  await cards(page).first().click();
  const dialog = page.getByRole('dialog');
  const image = dialog.getByRole('img');
  await expect(dialog).toContainText(
    '원본을 불러오지 못해 작은 미리보기로 표시했어요.',
  );
  await expect(image).toHaveAttribute('src', /\/demo\/1\.svg$/);
  const size = await image.boundingBox();
  expect(size!.width).toBeLessThanOrEqual(96);
  expect(size!.height).toBeLessThanOrEqual(96);
  await expect(
    dialog.getByRole('link', { name: /원본 이미지 열기/ }),
  ).toHaveAttribute('href', original);
  const next = dialog.getByRole('button', { name: '다음 이미지' });
  await next.focus();
  await next.press('Enter');
  await expect(image).toHaveAttribute('src', /\/demo\/2\.svg$/);
  await expect(dialog).not.toContainText('작은 미리보기로 표시했어요.');
  await expect(next).toBeFocused();
});

test('a stale refetch failure preserves the last successful result', async ({
  page,
}) => {
  await page.clock.install();
  let requests = 0;
  await page.route('**/api/search?**', (route) => {
    requests++;
    if (requests > 2)
      return route.fulfill({
        status: 503,
        json: { code: 'CONFIGURATION_ERROR' },
      });
    const q = new URL(route.request().url()).searchParams.get('q')!;
    return route.fulfill({ json: fixture(q) });
  });
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  await search(page, 'second');
  await expect(cards(page).first()).toHaveAccessibleName(
    'second 이미지 1 상세 보기',
  );
  await page.clock.fastForward(31_000);
  await page.goBack();
  await expect(
    page
      .getByRole('region', { name: '검색 결과', exact: true })
      .getByRole('alert'),
  ).toContainText('마지막으로 받은 결과');
  await expect(cards(page).first()).toHaveAccessibleName(
    '티셔츠 이미지 1 상세 보기',
  );
  expect(requests).toBe(3);
});

test('history changes close a preview permanently and restore a valid focus target', async ({
  page,
}) => {
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  await search(page, '포스터');
  await expect(cards(page).first()).toBeVisible();
  await cards(page).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goForward();
  await expect(page.getByRole('searchbox')).toHaveValue('포스터');
  await expect(page.getByRole('dialog')).toBeHidden();
});
