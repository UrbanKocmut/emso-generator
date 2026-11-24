import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import tools from '../../assets/js/tool-registry.js';

const routes = [tools.overview, ...tools];
for (const mobile of [false, true]) {
    test(`Chromium accepts the install manifest on ${mobile ? 'mobile' : 'desktop'}`, async ({ browser }) => {
        const context = await browser.newContext({
            viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
            isMobile: mobile, hasTouch: mobile, serviceWorkers: 'allow'
        });
        try {
            const page = await context.newPage();
            await page.goto('/');
            await page.evaluate(() => navigator.serviceWorker.ready);
            const session = await context.newCDPSession(page);
            const manifest = await session.send('Page.getAppManifest');
            expect(manifest.errors).toEqual([]);
            expect(JSON.parse(manifest.data).display).toBe('standalone');
            expect((await session.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
        } finally {
            await context.close();
        }
    });
}

test('each entry is real HTML with one correct panel and crawlable links before JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const route of routes) {
        const response = await page.goto('http://127.0.0.1:8876/' + route.path);
        expect(response.status()).toBe(200);
        await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', route.id);
        await expect(page.locator('[data-panel]')).toHaveCount(routes.length);
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://delavnica.kocmut.com/' + route.path);
        await expect(page.locator('.tool-nav a[href]')).toHaveCount(routes.length);
    }
    expect((await page.goto('http://127.0.0.1:8876/missing-tool/')).status()).toBe(404);
    await context.close();
});

test('mobile install control switches from instructions to the native prompt', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const help = page.locator('.install-help-button');
    await help.click();
    await expect(page.locator('#install-guide')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#install-guide')).toBeHidden();
    await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        event.prompt = async () => { window.promptInvoked = true; };
        event.userChoice = Promise.resolve({ outcome: 'dismissed' });
        window.dispatchEvent(event);
    });
    await expect(help).toBeHidden();
    await page.locator('#pwa-header-action').click();
    expect(await page.evaluate(() => window.promptInvoked)).toBe(true);
    await expect(help).toBeVisible();
});

test('the last mobile tab stays visible when the bundled font replaces a narrower fallback', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let captureFont;
    const pendingFont = new Promise(resolve => { captureFont = resolve; });
    await page.route('**/Nunito-Variable.ttf', captureFont, { times: 1 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: `
        @font-face {
            font-family: "Compact fallback";
            src: url("/fonts/IBMPlexSans-Bold.woff2");
            font-weight: 900;
            size-adjust: 70%;
        }
        .tool-nav-link .nav-label strong { font-family: Nunito, "Compact fallback", sans-serif; }
    ` });
    await page.evaluate(() => document.fonts.load('900 12px "Compact fallback"'));
    await page.locator('.tool-card[data-route="image-resizer"]').click();
    const tab = page.locator('.tool-nav-link[data-route="image-resizer"]');
    const overflow = () => tab.evaluate(link => link.getBoundingClientRect().right - link.closest('.sidebar').getBoundingClientRect().right);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await (await pendingFont).continue();
    await page.evaluate(() => document.fonts.ready);
    expect(await overflow()).toBeLessThanOrEqual(1);
});

test('clicks, history, reload, aliases, section anchors and new tabs share routes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { window.retainedMarker = {}; });
    await page.locator('.tool-card[data-route=json]').click();
    await expect(page).toHaveURL(/\/json\/$/);
    const installLinks = await page.locator('link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"]')
        .evaluateAll(links => Object.fromEntries(links.map(link => [link.rel, new URL(link.href).pathname])));
    expect(installLinks).toEqual({
        manifest: '/manifest.webmanifest',
        icon: '/assets/icons/favicon.png',
        'apple-touch-icon': '/assets/icons/apple-touch-icon.png'
    });
    const artworkPaths = await page.locator('.wordmark img, .tool-nav img, [data-panel]:visible .tool-art')
        .evaluateAll(images => images.map(image => new URL(image.src).pathname));
    expect(artworkPaths.length).toBeGreaterThan(tools.length);
    expect(artworkPaths.every(pathname => pathname.startsWith('/assets/igralnica/'))).toBe(true);
    await page.locator('#json-input').fill('{"n":9007199254740993,"n":-0}');
    await page.locator('#json-format').click();
    await page.locator('.tool-nav [data-route=emso]').click();
    await page.goBack();
    await expect(page.locator('#json-output')).toHaveValue(/9007199254740993/);
    expect(await page.evaluate(() => !!window.retainedMarker)).toBeTruthy();
    await page.goForward();
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'emso');
    await page.locator('.skip-link').focus();
    await page.locator('.skip-link').press('Enter');
    await expect(page).toHaveURL(/\/emso\/#main-content$/);
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'emso');
    await page.reload();
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'emso');
    await page.goto('/#vat');
    await expect(page).toHaveURL(/\/davcna-stevilka\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/emso\/#main-content$/);
    const prevented = await page.locator('.tool-nav [data-route=pdf]').evaluate(link => {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
        link.dispatchEvent(event);
        return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await page.locator('.tool-nav [data-route=pdf]').evaluate(link => { link.target = '_blank'; });
    const popupPromise = page.waitForEvent('popup');
    await page.locator('.tool-nav [data-route=pdf]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/pdf\/$/);
    await expect(popup.locator('#pdf-file')).toBeEnabled();
    await popup.close();
});

test('root file opening retains hash navigation and fixed asset root', async ({ page }) => {
    const file = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(file + '#json');
    await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'json');
    await page.locator('.tool-nav [data-route=pdf]').click();
    await expect(page).toHaveURL(file + '#pdf');
    await expect(page.locator('#pdf-file')).toBeEnabled();
    expect(await page.evaluate(() => window.DelavnicaRoot)).toBe(pathToFileURL(path.resolve('.') + path.sep).href);
});

test('fresh offline deep links use their cached HTML and unknown URLs stay missing', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8876/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
    await context.setOffline(true);
    for (const route of routes) {
        const fresh = await context.newPage();
        await fresh.goto('http://127.0.0.1:8876/' + route.path);
        await expect(fresh.locator('[data-panel]:visible')).toHaveAttribute('data-panel', route.id);
        if (route.id === 'overview') {
            const artwork = fresh.locator('.overview-grid .tool-card img');
            await expect(artwork).toHaveCount(tools.length);
            await artwork.evaluateAll(images => Promise.all(images.map(image => image.decode())));
        }
        if (route.id === 'pdf') await expect(fresh.locator('#pdf-file')).toBeEnabled();
        await fresh.close();
    }
    const missing = await page.goto('http://127.0.0.1:8876/unknown/').catch(() => null);
    if (missing) expect(missing.status()).toBe(404);
    await context.close();
});
