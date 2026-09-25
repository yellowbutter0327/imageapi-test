import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 768, 1440, 1920]) {
  test(`layout and keyboard at ${width}px`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Visual reference is recorded once in Chromium.',
    );
    await page.setViewportSize({ width, height: width >= 768 ? 720 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /상세 보기/ }).first(),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`layout-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: '본문으로 바로가기' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    const input = page.getByRole('searchbox');
    const inputSize = await input.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(inputSize).toBeGreaterThanOrEqual(16);
    await page
      .getByRole('button', { name: /상세 보기/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /원본 이미지 열기/ }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole('button', { name: '다음 이미지' }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole('button', { name: '미리보기 닫기' }),
    ).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Tab');
    expect(
      await page
        .getByRole('dialog')
        .evaluate((dialog) => dialog.contains(document.activeElement)),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`preview-${width}.png`),
      fullPage: false,
    });
  });
}
