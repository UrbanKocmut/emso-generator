import { test, expect } from '@playwright/test';

async function touch(page, type, x, y = 280) {
    return page.evaluate(({ type, x, y }) => {
        const target = document.querySelector('[data-panel]:not([hidden])');
        const point = new Touch({ identifier: 1, target, clientX: x, clientY: y });
        const ended = type === 'touchend' || type === 'touchcancel';
        const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches: ended ? [] : [point], targetTouches: ended ? [] : [point], changedTouches: [point] });
        target.dispatchEvent(event);
        return event.defaultPrevented;
    }, { type, x, y });
}
test('reduced motion, vertical gesture arbitration and orientation changes retain state', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8876/json/');
    await page.locator('#json-input').fill('{"retained":123}');
    await page.locator('#json-format').click();
    await touch(page, 'touchstart', 300);
    expect(await touch(page, 'touchmove', 295, 420)).toBe(false);
    await touch(page, 'touchend', 295, 420);
    await expect(page).toHaveURL(/\/json\/$/);
    await touch(page, 'touchstart', 300); await touch(page, 'touchmove', 100); await touch(page, 'touchend', 100);
    await expect(page).toHaveURL(/\/sparkasse-csv-qif\/$/);
    // Resize while the next swipe is dragging: it cancels cleanly.
    await touch(page, 'touchstart', 300); await touch(page, 'touchmove', 100);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.is-swiping, .is-swipe-settling')).toHaveCount(0);
    await expect(page.locator('[data-panel]:visible')).toHaveCount(1);
    await page.locator('.tool-nav [data-route=json]').click();
    await expect(page.locator('#json-input')).toHaveValue('{"retained":123}');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tool-nav [data-route=overview]').click();
    await page.locator('#mobile-info-hint').click();
    await expect(page.locator('#mobile-info-hint')).toHaveAttribute('aria-expanded', 'true');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#mobile-info-rail')).toHaveAttribute('inert', '');
    await context.close();
});
