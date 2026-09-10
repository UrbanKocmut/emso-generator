import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import tools from '../../assets/js/tool-registry.js';

const call = (page, name, args = {}) => page.evaluate(({ name, args }) => window.DelavnicaAgent.execute(name, args), { name, args });
async function fixture(page, name, mimeType = 'image/png', width = 40, height = 20) {
    const base64 = await page.evaluate(({ mimeType, width, height }) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, width / 2, height);
        return canvas.toDataURL(mimeType, 0.9).split(',')[1];
    }, { mimeType, width, height });
    return { name, mimeType, buffer: Buffer.from(base64, 'base64') };
}
const selectedIds = async page => (await call(page, 'list_selected_files')).result.files.filter(file => file.tool === 'image-resizer').map(file => file.id);
async function artifactBytes(page, artifact) {
    const chunks = [];
    for (let offset = 0; offset < artifact.size;) {
        const { result } = await call(page, 'read_artifact', { id: artifact.id, offset });
        chunks.push(Buffer.from(result.base64, 'base64')); offset = result.nextOffset;
    }
    return Buffer.concat(chunks);
}

test('XML validates real syntax and preserves namespaces, lexical tokens and whitespace', async ({ page }) => {
    await page.goto('/xml/');
    const cases = [
        ['<r><a/><b/></r>', '<r>\n  <a/>\n  <b/>\n</r>'],
        ['<?xml version="1.0"?><r xmlns:p="urn:test" b="&quot; >" a=\'&lt;\'><p:a/><!-- > --></r>', '<?xml version="1.0"?>\n<r xmlns:p="urn:test" b="&quot; >" a=\'&lt;\'>\n  <p:a/>\n  <!-- > -->\n</r>'],
        ['<r><a>before <b><c/></b> after</a><d/></r>', '<r>\n  <a>before <b><c/></b> after</a>\n  <d/>\n</r>'],
        ['<r><a xml:space="preserve"> \r\n <b><c/></b> </a><d/></r>', '<r>\n  <a xml:space="preserve"> \r\n <b><c/></b> </a>\n  <d/>\n</r>'],
        ['<r><a><![CDATA[ < > & ]]><b/></a><d/></r>', '<r>\n  <a><![CDATA[ < > & ]]><b/></a>\n  <d/>\n</r>'],
        ['<r> <b/></r>', '<r> <b/></r>'],
        ['<parsererror xmlns="http://www.w3.org/1999/xhtml"><b/></parsererror>', '<parsererror xmlns="http://www.w3.org/1999/xhtml">\n  <b/>\n</parsererror>'],
        ['\uFEFF<?xml version="1.0"?><r><x/></r>', '\uFEFF<?xml version="1.0"?>\n<r>\n  <x/>\n</r>'],
        ['<r xml:space="pre&#115;erve"> <b><c/></b> </r>', '<r xml:space="pre&#115;erve"> <b><c/></b> </r>'],
        ['<!-- <!DOCTYPE fake> --><r><?demo a=">"?><a/></r>', '<!-- <!DOCTYPE fake> -->\n<r>\n  <?demo a=">"?>\n  <a/>\n</r>']
    ];
    for (const [text, expected] of cases) {
        const result = await call(page, 'format_xml', { text });
        expect(result.success, JSON.stringify(result.error)).toBe(true); expect(result.result.text).toBe(expected);
        expect((await call(page, 'format_xml', { text: result.result.text })).result.text).toBe(expected);
    }
    for (const text of ['<a>', '<a><b></a>', '<p:a/>', '<a x="1" x="2"/>', '<a>&unknown;</a>', '<a/><b/>', '<!DOCTYPE a SYSTEM "https://example.test/private-xml"><a/>', '<!ENTITY a "x"><a/>', '<a><!-- unterminated</a>']) {
        const result = await call(page, 'format_xml', { text }); expect(result.success).toBe(false);
        await expect(page.locator('#xml-output')).toHaveValue('');
    }
    await page.locator('#xml-input').fill('<r><a/></r>'); await page.locator('#xml-indent').selectOption('tab');
    await page.locator('#xml-input').press('Control+Enter');
    await expect(page.locator('#xml-output')).toHaveValue('<r>\n\t<a/>\n</r>');
    await page.locator('#xml-input').fill('<r/>'); await expect(page.locator('#xml-output')).toHaveValue('');
    await page.locator('#xml-clear').click(); await expect(page.locator('#xml-input')).toHaveValue('');
});

test('JWT controls sign all algorithms, help with times and invalidate secrets/tokens on Clear', async ({ page }) => {
    await page.goto('/jwt-generator/');
    await page.clock.setFixedTime(new Date('2026-09-10T10:00:00Z'));
    for (const algorithm of ['HS256', 'HS384', 'HS512']) {
        await page.locator('#jwt-generator-algorithm').selectOption(algorithm);
        await page.locator('#jwt-generator-random').click();
        const secret = await page.locator('#jwt-generator-secret').inputValue();
        expect(Buffer.from(secret, 'base64').length).toBe(Number(algorithm.slice(2)) / 8);
        await page.locator('#jwt-generator-subject').fill('Žiga private-jwt-sentinel');
        await page.locator('#jwt-generator-now').click(); await page.locator('#jwt-generator-hour').click();
        await page.locator('#jwt-generator-customClaims').fill('{"role":"član"}');
        await page.locator('#jwt-generator-customClaims').press('Control+Enter');
        await expect(page.locator('#jwt-generator-output')).not.toHaveValue('');
        const token = await page.locator('#jwt-generator-output').inputValue();
        const [header, payload, signature] = token.split('.');
        expect(signature).toBe(createHmac('sha' + algorithm.slice(2), Buffer.from(secret, 'base64')).update(header + '.' + payload).digest('base64url'));
        expect(JSON.parse(Buffer.from(payload, 'base64url'))).toMatchObject({ iat: 1789034400, exp: 1789038000, role: 'član' });
        await page.locator('#jwt-generator-subject').fill('changed'); await expect(page.locator('#jwt-generator-output')).toHaveValue('');
    }
    const result = await call(page, 'generate_jwt', { secret: 'short' }); expect(result.success).toBe(false);
    await expect(page.locator('#jwt-generator-status')).toContainText('32 bajti');
    await page.locator('#jwt-generator-clear').click();
    await expect(page.locator('#jwt-generator-secret')).toHaveValue(''); await expect(page.locator('#jwt-generator-customClaims')).toHaveValue('{}');
    await expect(page.locator('#jwt-generator-header')).toHaveText('');
});

test('Clear during Web Crypto signing prevents stale JWT output', async ({ page }) => {
    await page.goto('/jwt-generator/');
    await page.evaluate(() => {
        const sign = crypto.subtle.sign.bind(crypto.subtle);
        crypto.subtle.sign = async (...args) => { window.signStarted = true; await new Promise(resolve => { window.releaseSign = resolve; }); return sign(...args); };
        window.pending = window.DelavnicaAgent.execute('generate_jwt', { secret: 'x'.repeat(32) });
    });
    await expect.poll(() => page.evaluate(() => !!window.signStarted)).toBe(true);
    await page.locator('#jwt-generator-clear').click();
    expect(await page.evaluate(async () => { window.releaseSign(); return (await window.pending).error.code; })).toBe('CANCELLED');
    await expect(page.locator('#jwt-generator-output')).toHaveValue('');
});

test('real image batch preserves partial success, orientation, transparency, formats and ZIP downloads', async ({ page }) => {
    await page.goto('/image-resizer/');
    const png = await fixture(page, 'same.png');
    const jpeg = await fixture(page, 'same.jpg', 'image/jpeg', 80, 40);
    // EXIF orientation 6: 90 degrees clockwise. Little-endian TIFF IFD0.
    const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
    jpeg.buffer = Buffer.concat([jpeg.buffer.subarray(0, 2), exif, jpeg.buffer.subarray(2)]);
    const webp = await fixture(page, 'third.webp', 'image/webp', 24, 36);
    await page.locator('#image-resizer-file').setInputFiles([png, jpeg, webp, { name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('bad') }]);
    await expect(page.locator('.image-card')).toHaveCount(4);
    await expect(page.locator('.image-card').nth(1)).toContainText('40 × 80 px');
    const ids = await selectedIds(page);
    const result = await call(page, 'resize_images', { fileIds: ids, maxWidth: 20, maxHeight: 20, format: 'image/png' });
    expect(result.success).toBe(true); expect(result.result.count).toBe(3);
    expect(result.result.images.map(image => image.success)).toEqual([true, true, true, false]);
    expect(result.result.images[1]).toMatchObject({ width: 10, height: 20, sourceWidth: 40, sourceHeight: 80 });
    const zipped = unzipSync(await artifactBytes(page, result.result.zipArtifact));
    expect(Object.keys(zipped)).toEqual(['same.png', 'same (2).png', 'third.png']);
    expect(zipped['same.png']).toEqual(new Uint8Array(await artifactBytes(page, result.result.images[0].artifact)));
    const pixel = await page.evaluate(async url => {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close(); return [...ctx.getImageData(19, 0, 1, 1).data];
    }, result.result.images[0].artifact.downloadUrl);
    expect(pixel[3]).toBe(0);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#image-resizer-downloads a').click();
    const download = await downloadPromise; expect(await readFile(await download.path())).toEqual(await artifactBytes(page, result.result.zipArtifact));
    for (const format of ['source', 'image/jpeg', 'image/webp']) {
        const converted = (await call(page, 'resize_images', { fileIds: [ids[0]], mode: 'percentage', percentage: 200, format })).result;
        expect(converted.images[0]).toMatchObject({ width: 80, height: 40, mimeType: format === 'source' ? 'image/png' : format });
        if (format === 'image/jpeg') {
            const rgb = await page.evaluate(async url => {
                const bitmap = await createImageBitmap(await (await fetch(url)).blob()); const c = document.createElement('canvas'); c.width = 80; c.height = 40;
                const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close(); return [...ctx.getImageData(79, 0, 1, 1).data];
            }, converted.images[0].artifact.downloadUrl);
            expect(rgb).toEqual([255, 255, 255, 255]);
        }
    }
    await page.locator('#image-resizer-percentage').fill('18'); await expect(page.locator('.image-card a')).toHaveCount(0);
    expect((await call(page, 'read_artifact', { id: result.result.zipArtifact.id })).error.code).toBe('ARTIFACT_NOT_FOUND');
    await page.locator('#image-resizer-clear').click(); expect(await selectedIds(page)).toEqual([]);
});

test('image limits, encoder fallback and preview cleanup report failures clearly', async ({ page }) => {
    await page.goto('/image-resizer/');
    await page.evaluate(() => {
        window.liveUrls = new Set();
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); window.liveUrls.add(url); return url; };
        URL.revokeObjectURL = url => { window.liveUrls.delete(url); revoke(url); };
    });
    const png = await fixture(page, 'valid.png');
    const oversized = Buffer.from(png.buffer); oversized.writeUInt32BE(10000, 16); oversized.writeUInt32BE(4001, 20);
    await page.locator('#image-resizer-file').setInputFiles([png, { ...png, name: 'oversized.png', buffer: oversized }]);
    await expect(page.locator('.image-card').nth(1)).toContainText('40 milijonov');
    await page.evaluate(() => {
        const toBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) { return toBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality); };
    });
    const result = await call(page, 'resize_images', { fileIds: await selectedIds(page), format: 'image/webp' });
    expect(result.result.images[0].error.code).toBe('UNSUPPORTED_FORMAT'); expect(result.result.images[1].error.code).toBe('LIMIT_EXCEEDED');
    await page.locator('.image-card').first().getByRole('button').click();
    expect(await page.evaluate(() => window.liveUrls.size)).toBe(0);
    await page.locator('#image-resizer-clear').click();
    await page.locator('#image-resizer-file').setInputFiles(Array.from({ length: 51 }, (_, index) => ({ ...png, name: index + '.png' })));
    await expect(page.locator('.image-card')).toHaveCount(50); await expect(page.locator('#image-resizer-status')).toContainText('Največ 50');
    await page.locator('#image-resizer-clear').click();
    await expect.poll(() => page.evaluate(() => window.liveUrls.size)).toBe(0);
});

test('Clear during preview or encoding cancels files, URLs and in-flight outputs', async ({ page }) => {
    await page.goto('/image-resizer/');
    const png = await fixture(page, 'slow.png');
    await page.evaluate(() => {
        const read = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () { window.readStarted = true; await new Promise(resolve => { window.releaseRead = resolve; }); return read.call(this); };
    });
    await page.locator('#image-resizer-file').setInputFiles(png);
    await expect.poll(() => page.evaluate(() => !!window.readStarted)).toBe(true);
    await page.locator('#image-resizer-clear').click(); await page.evaluate(() => window.releaseRead());
    await expect(page.locator('.image-card')).toHaveCount(0); expect(await selectedIds(page)).toEqual([]);
    await page.reload();
    await page.locator('#image-resizer-file').setInputFiles(png); await expect(page.locator('.image-card')).toContainText('Pripravljeno.');
    await page.evaluate(() => {
        const toBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
            if (this.width === 1) return toBlob.call(this, callback, type, quality);
            window.encodingStarted = true; window.releaseEncoding = () => toBlob.call(this, callback, type, quality);
        };
        window.pending = window.DelavnicaAgent.execute('resize_images', { fileIds: window.DelavnicaSession.files.list().map(file => file.id) });
    });
    await expect.poll(() => page.evaluate(() => !!window.encodingStarted)).toBe(true);
    await page.locator('#image-resizer-clear').click();
    expect(await page.evaluate(async () => { window.releaseEncoding(); return (await window.pending).error.code; })).toBe('CANCELLED');
    await expect(page.locator('.image-card')).toHaveCount(0); await expect(page.locator('#image-resizer-downloads a')).toHaveCount(0);
});

test('new operations work offline without input-bearing requests or persistent data', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    const requests = []; page.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
    await page.goto('/xml/'); await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    expect((await call(page, 'format_xml', { text: '<r>private-new-sentinel</r>' })).success).toBe(true);
    expect((await call(page, 'generate_jwt', { secret: 'private-new-sentinel'.repeat(3), subject: 'private-new-sentinel' })).success).toBe(true);
    await page.locator('.tool-nav [data-route="image-resizer"]').click();
    await page.locator('#image-resizer-file').setInputFiles(await fixture(page, 'private-new-sentinel.png'));
    const result = await call(page, 'resize_images', { fileIds: await selectedIds(page) }); expect(result.result.count).toBe(1); expect(result.result.zipArtifact).toBeTruthy();
    expect(requests.every(req => req.method === 'GET' && !req.body && !req.url.includes('private-new-sentinel') && (req.url.startsWith('blob:') || new URL(req.url).origin === 'http://127.0.0.1:8876'))).toBe(true);
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
    const cacheText = await page.evaluate(async () => {
        const text = [];
        for (const name of await caches.keys()) { const cache = await caches.open(name); for (const req of await cache.keys()) { text.push(req.url); if (/\.(html|js|json)$/.test(req.url)) text.push(await (await cache.match(req)).text()); } }
        return text.join('');
    });
    expect(cacheText).not.toContain('private-new-sentinel'); await context.close();
});

test('cached v2 bundles cannot hide new operations while an update is waiting', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage(); await page.goto('/'); await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.evaluate(async () => {
        const cache = await caches.open((await caches.keys()).find(name => name.startsWith('delavnica-runtime-')));
        for (const name of ['toolbox-ui', 'tool-registry']) await cache.put(new URL('/assets/v2/' + name + '.js', location.href), new Response('throw new Error("stale-v2-bundle");', { headers: { 'Content-Type': 'text/javascript' } }));
    });
    await context.setOffline(true);
    const fresh = await context.newPage(); await fresh.goto('/xml/');
    expect((await call(fresh, 'format_xml', { text: '<a><b/></a>' })).success).toBe(true);
    expect(await fresh.evaluate(() => window.DelavnicaAgent.apiVersion)).toBe('1.1.0');
    await context.close();
});

test('new navigation supports keyboard, scrolling, history and swipes; image drop uses the same batch', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage(); await page.goto('/pdf/');
    await page.locator('.tool-nav [data-route="pdf"]').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/xml\/$/);
    await page.evaluate(() => {
        const target = document.querySelector('#xml-title');
        for (const [type, x] of [['touchstart', 310], ['touchmove', 80], ['touchend', 80]]) {
            const point = new Touch({ identifier: 1, target, clientX: x, clientY: 180 });
            target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [point], changedTouches: [point] }));
        }
    });
    await expect(page).toHaveURL(/\/jwt-generator\/$/);
    await page.locator('.tool-nav [data-route="image-resizer"]').click();
    await page.goBack(); await expect(page).toHaveURL(/\/jwt-generator\/$/); await page.goForward();
    const png = await fixture(page, 'drop.png');
    await page.evaluate(({ data }) => {
        const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], 'drop.png', { type: 'image/png' }));
        document.getElementById('image-resizer-drop').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, { data: png.buffer.toString('base64') });
    await expect(page.locator('.image-card')).toContainText('drop.png');
    await page.locator('#image-resizer-mode').press('Control+Enter');
    await expect(page.locator('#image-resizer-status')).toContainText('1/1');
    await expect(page.locator('.image-card a')).toHaveCount(1); await context.close();
});

for (const [width, height] of [[390, 844], [768, 1024], [844, 390], [1440, 900]]) {
    test(`expanded overview and new pages remain accessible ${width}x${height}`, async ({ browser }, testInfo) => {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 844, serviceWorkers: 'block' });
        const page = await context.newPage();
        for (const route of [tools.overview, ...tools.slice(-3)]) {
            await page.goto('/' + route.path); await page.evaluate(() => document.fonts.ready);
            await expect(page.locator('[data-panel]:visible')).toHaveAttribute('data-panel', route.id);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            if (width <= 844 && route.id !== 'overview') {
                const visible = await page.locator('.tool-nav [aria-current="page"]').evaluate(el => {
                    const box = el.getBoundingClientRect(), parent = el.closest('.sidebar').getBoundingClientRect();
                    return box.left >= parent.left - 1 && box.right <= parent.right + 1 && box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1;
                }); expect(visible).toBe(true);
            }
            await page.screenshot({ path: testInfo.outputPath(`${route.id}-${width}x${height}.png`), fullPage: true });
        }
        await context.close();
    });
}
