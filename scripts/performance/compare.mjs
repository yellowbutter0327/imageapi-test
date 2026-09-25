import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

// Run against production builds. The original source is never patched.
const baselineDir = process.env.BASELINE_BUILD_DIR;
const target = process.env.BENCHMARK_URL ?? 'http://127.0.0.1:3103';
const output =
  process.env.BENCHMARK_OUTPUT ?? 'docs/performance/comparison.json';
if (!baselineDir)
  throw new Error(
    'Set BASELINE_BUILD_DIR to the original CRA build directory.',
  );
const fixtures = new Map();
for (const q of ['티셔츠', '포스터']) {
  for (const size of [12, 28]) {
    const response = await fetch(
      `${target}/api/search?${new URLSearchParams({ q, sort: 'date', page: '1', pageSize: String(size) })}`,
    );
    if (!response.ok) throw new Error('Benchmark requires the local demo API.');
    const data = await response.json();
    if (data.mode !== 'demo')
      throw new Error('Refusing to benchmark a live upstream.');
    fixtures.set(`${q}/${size}`, data);
  }
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.png': 'image/png',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/v1/search/image') {
      const data = fixtures.get(
        `${url.searchParams.get('query')}/${url.searchParams.get('display')}`,
      );
      if (!data) {
        res.writeHead(400);
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          total: data.total,
          items: data.items.map((image) => ({
            ...image,
            link: image.original,
          })),
        }),
      );
      return;
    }
    const publicAsset = url.pathname.startsWith('/demo/');
    const directory = path.resolve(publicAsset ? 'public' : baselineDir);
    const filename = path.resolve(
      directory,
      `.${url.pathname === '/' ? '/index.html' : url.pathname}`,
    );
    if (!filename.startsWith(directory + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const buffer = await readFile(filename);
    const type = mime[path.extname(filename)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader(
      'Cache-Control',
      /\.(js|css|woff)$/.test(filename)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    );
    if (
      /html|javascript|css|svg/.test(type) &&
      req.headers['accept-encoding']?.includes('gzip')
    ) {
      res.setHeader('Content-Encoding', 'gzip');
      res.end(gzipSync(buffer));
    } else res.end(buffer);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseline = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const samples = [];
try {
  for (const width of [390, 1440]) {
    for (let run = 1; run <= 5; run++) {
      // Alternate target order to reduce systematic machine warm-up bias.
      for (const name of run % 2
        ? ['original', 'next']
        : ['next', 'original']) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: 'reduce',
        });
        await context.addInitScript(() => {
          window.__lab = { lcp: 0, cls: 0, session: 0, start: 0, last: 0 };
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              window.__lab.lcp = entry.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              const lab = window.__lab;
              if (
                entry.startTime - lab.last > 1000 ||
                entry.startTime - lab.start > 5000
              ) {
                lab.session = 0;
                lab.start = entry.startTime;
              }
              lab.session += entry.value;
              lab.last = entry.startTime;
              lab.cls = Math.max(lab.cls, lab.session);
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const page = await context.newPage();
        const url =
          name === 'next' ? `${target}/?q=티셔츠&sort=date` : baseline;
        const imageSelector = name === 'next' ? '.image-card img' : '.item-img';
        for (const cache of ['cold', 'warm']) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.locator(imageSelector).first().waitFor();
          await page.waitForFunction((selector) => {
            const image = document.querySelector(selector);
            return image?.complete && image.naturalWidth > 0;
          }, imageSelector);
          const firstImageReadyMs = await page.evaluate(() =>
            performance.now(),
          );
          await page.evaluate(() => document.fonts.ready);
          await page.waitForLoadState('networkidle');
          const metrics = await page.evaluate(() => {
            const resources = performance.getEntriesByType('resource');
            const sum = (pattern, field) =>
              resources
                .filter((r) => pattern.test(r.name))
                .reduce((total, r) => total + r[field], 0);
            return {
              ...window.__lab,
              jsBytes: sum(/\.js(?:\?|$)/, 'encodedBodySize'),
              cssBytes: sum(/\.css(?:\?|$)/, 'encodedBodySize'),
              fontBytes: sum(/\.woff2?(?:\?|$)/, 'encodedBodySize'),
              transferBytes: resources.reduce(
                (total, r) => total + r.transferSize,
                0,
              ),
              requests: resources.length,
              searchRequests: resources.filter((r) =>
                /\/api\/search\?|\/v1\/search\/image\?/.test(r.name),
              ).length,
            };
          });
          const expectedCount = width < 1200 ? 12 : 28;
          const count = await page.locator(imageSelector).count();
          if (count !== expectedCount)
            throw new Error(`Count mismatch: ${name}/${width}/${count}`);
          const input =
            name === 'next'
              ? page.getByRole('searchbox')
              : page.getByPlaceholder(
                  '사진 이름,이미지 태그, 스타일 코드를 입력해주세요',
                );
          await input.fill('포스터');
          const searchStart = await page.evaluate(() => performance.now());
          await page.getByRole('button', { name: '검색', exact: true }).click();
          await page.waitForFunction((selector) => {
            const image = document.querySelector(selector);
            return (
              image?.complete &&
              image.naturalWidth > 0 &&
              /\/demo\/(?:7|8|9|10|11|12)\.svg/.test(
                image.getAttribute('src') ?? '',
              )
            );
          }, imageSelector);
          const searchImageReadyMs =
            (await page.evaluate(() => performance.now())) - searchStart;
          samples.push({
            name,
            width,
            run,
            cache,
            firstImageReadyMs,
            searchImageReadyMs,
            ...metrics,
          });
        }
        await context.close();
      }
    }
    console.log(`Measured viewport ${width}`);
  }
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = [];
  for (const width of [390, 1440])
    for (const name of ['original', 'next'])
      for (const cache of ['cold', 'warm']) {
        const group = samples.filter(
          (sample) =>
            sample.width === width &&
            sample.name === name &&
            sample.cache === cache,
        );
        summary.push({
          name,
          width,
          cache,
          ...Object.fromEntries(
            [
              'firstImageReadyMs',
              'searchImageReadyMs',
              'lcp',
              'cls',
              'jsBytes',
              'cssBytes',
              'fontBytes',
              'transferBytes',
              'searchRequests',
            ].map((key) => [key, median(group.map((row) => row[key]))]),
          ),
        });
      }
  const report = {
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      browser: browser.version(),
      cpuThrottle: 1,
      network: 'unthrottled loopback',
      runs: 5,
      baselineCommit: 'f110820',
      fixture:
        'Same local demo images, newest order, 12 or 28 items; native API response shapes; original build served with gzip',
    },
    summary,
    samples,
  };
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
  server.close();
}
