import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test('changing motion preference live stops and restores launcher motion', async ({ page }) => {
    await page.goto('/');
    const tile = page.locator('.tool-card[data-route="emso"]');
    const art = tile.locator('.card-art');
    const floating = () => art.evaluate(image => image.getAnimations().some(animation =>
        animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity
    ));
    const tilted = () => tile.evaluate(link => ['--toy-tilt-x', '--toy-tilt-y'].some(property =>
        Math.abs(parseFloat(link.style.getPropertyValue(property))) > 0
    ));

    await expect.poll(floating).toBe(true);
    await tile.hover({ position: { x: 30, y: 30 } });
    await expect.poll(tilted).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(floating).toBe(false);
    await expect.poll(tilted).toBe(false);
    await expect(page.locator('.motion-switch')).toBeHidden();
    await page.mouse.move(0, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(floating).toBe(true);
});

test('pausing an active tile flight cancels it and keeps the launcher still', async ({ page }) => {
    await page.goto('/');
    const motionSwitch = page.locator('.motion-switch');
    await expect(motionSwitch).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.tool-card[data-route="json"]').click();
    const flight = page.locator('.motion-flight');
    await expect(flight).toHaveCSS('pointer-events', 'none');
    await motionSwitch.click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect(motionSwitch).toHaveAttribute('aria-pressed', 'true');
    await expect(flight).toHaveCount(0);
    await page.locator('.wordmark').click();
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'overview');
    const movingArt = () => page.locator('.card-art').evaluateAll(images =>
        images.some(image => image.getAnimations().some(animation => animation.playState === 'running'))
    );
    expect(await movingArt()).toBe(false);
    await motionSwitch.click();
    await expect(motionSwitch).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(movingArt).toBe(true);
});

test('interrupted tool animation retains the result and the final route stays usable', async ({ page }) => {
    await page.goto('/emso/');
    const count = page.locator('#emso-count');
    const output = page.locator('#emso-output');
    await count.fill('2');
    await page.locator('#emso-form button[type="submit"]').click();
    await expect.poll(() => page.locator('[data-panel="emso"] .output-panel .panel-label').evaluate(label =>
        label.getAnimations().some(animation => animation.id.startsWith('igralnica-workspace-'))
    ), { intervals: [16, 32, 50] }).toBe(true);
    const generated = await output.inputValue();
    expect(generated).toMatch(/^\d{13}\n\d{13}$/);

    // Activate a different route on successive frames, while the previous
    // route still has entrance or result animations in flight.
    await page.evaluate(async () => {
        for (const route of ['vat', 'json', 'emso']) {
            document.querySelector(`.tool-nav [data-route="${route}"]`).click();
            await new Promise(requestAnimationFrame);
        }
    });
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'emso');
    await expect(output).toHaveValue(generated);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await count.fill('1');
    await page.locator('#emso-form button[type="submit"]').click();
    await expect(output).toHaveValue(/^\d{13}$/);
    const effects = await page.evaluate(() => document.getAnimations().filter(animation =>
        animation.id.startsWith('igralnica-workspace-')
    ).length);
    expect(effects).toBe(0);
});

test.describe('touch launcher', () => {
    test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

    test('a tap on the moving toy opens its tool', async ({ page }) => {
        await page.goto('/');
        // At the narrowest supported width all visible header actions must still
        // receive a tap, including the motion switch beside the install control.
        await page.evaluate(() => document.fonts.ready);
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 640 });
            const blocked = await page.locator('.masthead :is(a, button):visible').evaluateAll(actions =>
                actions.filter(action => {
                    const box = action.getBoundingClientRect();
                    return !action.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
                }).map(action => action.getAttribute('aria-label') || action.textContent.trim())
            );
            expect(blocked).toEqual([]);
            // The flex item may shrink below the width of its last letter.
            const wordmarkGap = await page.locator('.wordmark > span').evaluate(label => {
                const range = document.createRange();
                range.selectNodeContents(label);
                const switchStart = document.querySelector('.motion-switch').getBoundingClientRect().left;
                return switchStart - range.getBoundingClientRect().right;
            });
            expect(wordmarkGap).toBeGreaterThanOrEqual(0);
        }
        const art = page.locator('.tool-card[data-route="json"] .card-art');
        await expect.poll(() => art.evaluate(image => image.getAnimations().some(animation =>
            animation.playState === 'running'
        ))).toBe(true);
        const target = await art.evaluate(image => {
            const box = image.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            return { x, y, route: document.elementFromPoint(x, y)?.closest('a')?.dataset.route };
        });
        expect(target.route).toBe('json');
        await page.touchscreen.tap(target.x, target.y);
        await expect(page).toHaveURL(/\/json\/$/);
        await page.locator('#json-input').fill('{"ok":true}');
        await expect(page.locator('#json-output')).toHaveValue('{\n  "ok": true\n}');
    });
});
