import { test, expect } from '@playwright/test';

test('help sections keep their text inside separate, nonoverlapping cells', async ({ page }, testInfo) => {
    for (const [width, height] of [[1260, 1338], [1440, 900], [1181, 900], [1180, 900], [768, 1024], [844, 390], [500, 844], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const route of ['overview', 'emso', 'vat', 'jwt', 'json', 'qif', 'pdf']) {
            await page.goto('/#' + route);
            if (route === 'overview') await page.locator('.tray-guide > summary').click();
            const help = page.locator(`[data-panel="${route}"] .tool-help`);
            const cells = await help.locator('.reference-content > .reference-copy').evaluateAll(elements =>
                elements.map(element => ({
                    box: element.getBoundingClientRect().toJSON(),
                    fits: element.scrollWidth <= element.clientWidth + 1
                })));
            expect(cells.length).toBeGreaterThan(1);
            for (const [index, cell] of cells.entries()) {
                expect(cell.fits, `${route} help at ${width}px`).toBe(true);
                expect(cell.box.height).toBeGreaterThan(0);
                for (const previous of cells.slice(0, index)) {
                    const a = previous.box, b = cell.box;
                    expect(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1).toBe(true);
                }
            }
            if (route === 'json' && width === 1260) await help.screenshot({ path: testInfo.outputPath('json-help-desktop.png') });
        }
    }
});
