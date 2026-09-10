import { test, expect } from '@playwright/test';

test('help descriptions have one outer border and retain their column separators', async ({ page }, testInfo) => {
    for (const [width, height] of [[1260, 1338], [1440, 900], [1181, 900], [1180, 900], [768, 1024], [844, 390], [500, 844], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const route of ['overview', 'emso', 'vat', 'jwt', 'json', 'qif', 'pdf']) {
            await page.goto('/#' + route);
            const help = page.locator(`[data-panel="${route}"] .tool-help`);
            const cells = await help.locator('.reference-content > .reference-copy').evaluateAll(elements => elements.map(element => {
                const style = getComputedStyle(element);
                const leftEdge = element.parentElement.getBoundingClientRect().left;
                return {
                    atOuterEdge: Math.abs(element.getBoundingClientRect().left - leftEdge) < 1,
                    borderLeft: parseFloat(style.borderLeftWidth),
                    borderTop: parseFloat(style.borderTopWidth)
                };
            }));
            expect(cells.length).toBeGreaterThan(1);
            for (const cell of cells) {
                expect(cell.borderLeft, `${route} at ${width}px: only interior columns need a left border`).toBe(cell.atOuterEdge ? 0 : 2);
                if (width <= 1180) expect(cell.borderTop).toBe(2);
            }
            if (route === 'json' && width === 1260) await help.screenshot({ path: testInfo.outputPath('json-help-desktop.png') });
        }
    }
});
