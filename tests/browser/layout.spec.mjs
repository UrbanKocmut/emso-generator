import tools from '../../assets/js/tool-registry.js';
import { test, expect } from '@playwright/test';

const routes = [tools.overview, ...tools];
const sizes = [[320, 568], [390, 844], [500, 844], [844, 390], [768, 1024], [1280, 720], [1440, 900]];

for (const [width, height] of sizes) {
    test(`all workspaces fit at ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        for (const route of routes) {
            await page.goto('/' + route.path);
            await page.evaluate(() => document.fonts.ready);
            const panel = page.locator('[data-panel]:visible');
            await expect(panel).toHaveAttribute('data-panel', route.id);
            const overflow = await panel.evaluate(element => {
                const items = element.querySelectorAll('h1, .button, .tool-card, input:not([type="checkbox"]), select, textarea');
                return [...items].filter(item => {
                    const box = item.getBoundingClientRect();
                    return box.width > 1 && box.height > 1 && (box.left < -1 || box.right > innerWidth + 1);
                }).map(item => item.id || item.textContent.trim().slice(0, 40));
            });
            expect(overflow, `${route.id} at ${width}px`).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            if (route.id === 'overview') {
                const tiles = panel.locator('.tool-card');
                await expect(tiles).toHaveCount(tools.length);
                // Use layout positions while entrance transforms move the painted tiles.
                const columns = await tiles.evaluateAll(elements => new Set(elements.map(tile => tile.offsetLeft)).size);
                if (width <= 500) expect(columns).toBe(2);
                if (width >= 1280) expect(columns).toBe(3);
            }
        }
    });
}

for (const width of [639, 640, 641, 859, 860, 861, 1179, 1180, 1181]) {
    test(`layout boundary ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
            await page.goto('/' + route.path);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', route.id);
            await expect(page.locator('.tool-nav [data-route]')).toHaveCount(routes.length);
        }
    });
}

test('real-engine and mobile gesture regressions', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto('/tests/mobile-navigation.html');
    await page.locator('#run').click();
    await expect(page.locator('#summary')).toContainText('checks passed', { timeout: 80000 });
    expect(await page.locator('[data-result="fail"]').allTextContents()).toEqual([]);
    await context.close();
});
