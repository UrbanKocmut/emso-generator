import tools from '../../assets/js/tool-registry.js';
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A local-only release fixture server: no production endpoints or deployment.
async function fixtureServer() {
    let old = true; let failAsset = false;
    const legacy = new Set(['service-worker.js', 'precache-manifest.js', 'index.html', 'assets/js/toolbox-ui.js', 'assets/js/tool-registry.js']);
    const server = createServer(async (req, res) => {
        let name = new URL(req.url, 'http://localhost').pathname.slice(1);
        if (!name || name.endsWith('/')) name += 'index.html';
        if (name.includes('..') || (failAsset && name === 'fonts/IBMPlexMono-Regular.woff2')) { res.writeHead(404); res.end(); return; }
        const filename = old && legacy.has(name) ? path.join('tests/fixtures/previous-release', path.basename(name)) : name;
        try {
            const data = await readFile(filename);
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
            res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
        } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { origin: 'http://127.0.0.1:' + server.address().port, current() { old = false; }, fail() { failAsset = true; }, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('upgrade from the original release waits for an explicit update click', async ({ browser }) => {
    const server = await fixtureServer();
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
        const page = await context.newPage(); await page.goto(server.origin + '/#json');
        await page.evaluate(() => navigator.serviceWorker.ready);
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
        await page.locator('#json-input').fill('{"unsaved":"private-upgrade-sentinel"}');
        const oldCache = await page.evaluate(() => caches.keys());
        server.current();
        await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
        await expect(page.locator('#pwa-header-action')).toHaveText('POSODOBI', { timeout: 20000 });
        await expect(page.locator('#json-input')).toHaveValue('{"unsaved":"private-upgrade-sentinel"}');
        expect(await page.evaluate(() => !!window.DelavnicaAgent)).toBe(false);
        await page.locator('#pwa-header-action').click();
        await expect.poll(() => page.evaluate(() => !!window.DelavnicaAgent).catch(() => false)).toBe(true);
        await expect(page).toHaveURL(server.origin + '/json/');
        const newCache = await page.evaluate(() => caches.keys());
        expect(newCache.filter(name => name.startsWith('delavnica-runtime-'))).toHaveLength(1);
        expect(newCache).not.toEqual(oldCache);
        await context.setOffline(true);
        await page.goto(server.origin + '/pdf/');
        await expect(page.locator('#pdf-file')).toBeEnabled();
    } finally { await context.close(); await server.close(); }
});

test('failed installation leaves no partial cache and ordinary controls work', async ({ browser }) => {
    const server = await fixtureServer(); server.current(); server.fail();
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
        const page = await context.newPage(); await page.goto(server.origin + '/json/');
        await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            const worker = registration?.installing;
            if (worker && worker.state !== 'redundant') await new Promise(resolve => worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); }));
        });
        await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([]);
        await page.locator('#json-input').fill('{"n":-0}'); await page.locator('#json-format').click();
        await expect(page.locator('#json-output')).toHaveValue('{\n  "n": -0\n}');
    } finally { await context.close(); await server.close(); }
});

test('a new deep link works under the previous worker without interrupting an old tab', async ({ browser }) => {
    const server = await fixtureServer();
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
        const oldPage = await context.newPage(); await oldPage.goto(server.origin + '/#json');
        await oldPage.evaluate(() => navigator.serviceWorker.ready);
        await expect.poll(() => oldPage.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
        await oldPage.locator('#json-input').fill('{"unsaved":"old-tab-sentinel"}');
        server.current();
        const fresh = await context.newPage(); await fresh.goto(server.origin + '/json/');
        await expect(fresh.locator('[data-panel]:visible')).toHaveAttribute('data-panel', 'json');
        await expect(fresh.locator('.tool-nav a')).toHaveCount(tools.length + 1);
        const result = await fresh.evaluate(() => window.DelavnicaAgent.execute('format_json', {text:'{"n":9007199254740993}'}));
        expect(result.success).toBe(true);
        await expect(fresh.locator('#json-output')).toHaveValue(/9007199254740993/);
        await fresh.locator('.tool-nav [data-route=pdf]').click();
        await expect(fresh.locator('#pdf-file')).toBeEnabled();
        expect(await fresh.evaluate(() => typeof window.DelavnicaPdfWorkspace?.compose)).toBe('function');
        await expect(fresh.locator('#pwa-header-action')).toHaveText('POSODOBI');
        await expect(oldPage.locator('#json-input')).toHaveValue('{"unsaved":"old-tab-sentinel"}');
        expect(await oldPage.evaluate(() => !!window.DelavnicaAgent)).toBe(false);
    } finally { await context.close(); await server.close(); }
});

test('tool inputs and artifacts never enter service-worker caches or storage', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    try {
        await page.goto('http://127.0.0.1:8876/json/');
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.evaluate(() => window.DelavnicaAgent.execute('format_json', { text: '{"private-cache-sentinel":9007199254740993}' }));
        await page.evaluate(() => window.DelavnicaAgent.execute('convert_sparkasse_csv', { text: 'Datum knjiženja;Naziv prejemnika;V breme;V dobro;Namen\n10.09.2026;private-cache-sentinel;12,34;;Test\n' }));
        const stored = await page.evaluate(async () => {
            const keys = [];
            for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) keys.push(request.url);
            return { keys, local: { ...localStorage }, session: { ...sessionStorage } };
        });
        expect(stored.keys.length).toBeGreaterThan(200);
        expect(stored.keys.some(url => /private-cache-sentinel|blob:|artifact-|file-/.test(url) && !url.endsWith('/file-output.js'))).toBe(false);
        expect(stored.local).toEqual({}); expect(stored.session).toEqual({});
    } finally { await context.close(); }
});
