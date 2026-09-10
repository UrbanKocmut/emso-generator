import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import tools from '../../assets/js/tool-registry.js';

const routes = [tools.overview, ...tools];
test('each entry is real HTML with one correct panel and crawlable links before JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const route of routes) {
        const response = await page.goto('http://127.0.0.1:8876/' + route.path);
        expect(response.status()).toBe(200);
        await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', route.id);
        await expect(page.locator('[data-panel]')).toHaveCount(7);
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://delavnica.kocmut.com/' + route.path);
        await expect(page.locator('.tool-nav a[href]')).toHaveCount(7);
    }
    expect((await page.goto('http://127.0.0.1:8876/missing-tool/')).status()).toBe(404);
    await context.close();
});

test('clicks, history, reload, aliases, section anchors and new tabs share routes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { window.retainedMarker = {}; });
    await page.locator('.tool-nav [data-route=json]').click();
    await expect(page).toHaveURL(/\/json\/$/);
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
        if (route.id === 'pdf') await expect(fresh.locator('#pdf-file')).toBeEnabled();
        await fresh.close();
    }
    const missing = await page.goto('http://127.0.0.1:8876/unknown/').catch(() => null);
    if (missing) expect(missing.status()).toBe(404);
    await context.close();
});
