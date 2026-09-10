import { test, expect } from '@playwright/test';

const routes = ['overview', 'emso', 'vat', 'jwt', 'json', 'qif', 'pdf'];
const sizes = [[390, 844], [500, 844], [844, 390], [768, 1024], [1280, 720], [1440, 900]];

async function fixture(page, route) {
    await page.clock.setFixedTime(new Date('2026-09-10T10:00:00Z'));
    await page.goto('/#' + route);
    await page.evaluate(async () => {
        await document.fonts.ready;
        document.getElementById('emso-output').value = '0101000500006\n0202001500019';
        document.getElementById('emso-output-count').textContent = '2 ZAPISOV';
        document.getElementById('vat-output').value = '15012557\n10000020';
        document.getElementById('vat-output-count').textContent = '2 ZAPISOV';
    });
    if (route === 'pdf') await expect(page.locator('#pdf-file')).toBeEnabled();
}

for (const [width, height] of sizes) {
    for (const route of routes) {
        test(`${route} ${width}x${height}`, async ({ browser }, testInfo) => {
            const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 844, serviceWorkers: 'block' });
            const page = await context.newPage();
            await fixture(page, route);
            // Preserve the full pre-change page as evidence, while gating only the
            // original workspace. New help below it is intentionally independent.
            if (process.env.CAPTURE_BASELINE) await page.screenshot({ path: `tests/browser/baseline-pages/${route}-${width}x${height}.png`, fullPage: true });
            const panel = page.locator(`[data-panel="${route}"]`);
            const clip = await panel.evaluate(el => {
                const box = el.getBoundingClientRect();
                const children = [...el.children].filter(child => !child.classList.contains('reference-panel') && !child.hasAttribute('data-agent-status'));
                const bottom = Math.max(...children.map(child => child.getBoundingClientRect().bottom));
                return { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, innerWidth - Math.max(0, box.x)), height: Math.min(bottom, innerHeight) - Math.max(0, box.y) };
            });
            await expect(page).toHaveScreenshot(`${route}-${width}x${height}.png`, { clip });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
            await context.close();
        });
    }
}

for (const width of [639, 640, 641, 859, 860, 861, 1179, 1180, 1181]) {
    test(`layout boundary ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
            await fixture(page, route);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
            await expect(page.locator('[data-panel]:visible')).toHaveCount(1);
            await expect(page.locator('.tool-nav [data-route]')).toHaveCount(7);
        }
    });
}

test('existing real-engine and mobile gesture regressions', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto('/tests/mobile-navigation.html');
    await page.locator('#run').click();
    await expect(page.locator('#summary')).toContainText('checks passed', { timeout: 80000 });
    expect(await page.locator('[data-result="fail"]').allTextContents()).toEqual([]);
    await context.close();
});
