import { expect, test } from '@playwright/test';

// These reviewed references use the pinned Windows Chromium rasterizer.
test.skip(process.platform !== 'win32', 'Visual comparisons run in the Windows CI job');
test.use({ locale: 'sl-SI', contextOptions: { reducedMotion: 'reduce' }, serviceWorkers: 'block' });

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test(`Igralnica launcher at ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await page.locator('.tool-card img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await expect(page).toHaveScreenshot(`launcher-${width}x${height}.png`);
    });
}

test('JSON workspace with formatted data', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/json/');
    await page.locator('#json-input').fill('{"kraj":"Bled","id":7}');
    await page.locator('#json-format').click();
    await expect(page.locator('#json-output')).toHaveValue('{\n  "kraj": "Bled",\n  "id": 7\n}');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot('json-desktop.png');
});

test('mobile PDF workspace with imported pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pdf/');
    await expect(page.locator('#pdf-file')).toBeEnabled();
    await expect(page.locator('.motion-switch')).toBeHidden();
    await page.evaluate(async () => {
        const { PDFDocument, rgb } = await import('/assets/vendor/pdf-lib/pdf-lib.esm.min.js');
        const pdf = await PDFDocument.create();
        for (const ink of [rgb(.15, .18, .9), rgb(.95, .25, .12)]) {
            const sheet = pdf.addPage([220, 300]);
            sheet.drawRectangle({ x: 0, y: 0, width: 220, height: 300, color: rgb(1, .96, .85) });
            sheet.drawCircle({ x: 95, y: 150, size: 75, color: ink });
        }
        const transfer = new DataTransfer();
        transfer.items.add(new File([await pdf.save()], 'primer.pdf', { type: 'application/pdf' }));
        const input = document.getElementById('pdf-file');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('.pdf-page-card')).toHaveCount(2);
    await expect(page.locator('#pdf-pages canvas:visible')).toHaveCount(2);
    await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('#pdf-download')).toBeInViewport({ ratio: 1 });
    await expect(page).toHaveScreenshot('pdf-mobile.png');
});
