import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { OPERATIONS } from '../../src/operations/catalog.mjs';
const { PDFDocument } = await import('data:text/javascript;base64,' + (await readFile(new URL('../../assets/vendor/pdf-lib/pdf-lib.esm.min.js', import.meta.url))).toString('base64'));

const csv = OPERATIONS.find(op => op.name === 'convert_sparkasse_csv').example.text;
const call = (page, name, args = {}) => page.evaluate(({ name, args }) => window.DelavnicaAgent.execute(name, args), { name, args });
async function pdfBytes() { const pdf = await PDFDocument.create(); pdf.addPage([200, 300]); pdf.addPage([300, 200]); return Buffer.from(await pdf.save()); }

test('six operations update the existing controls, return artifacts and retain PDF state', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), body: request.postData(), method: request.method() }));
    await page.goto('/');
    await page.evaluate(() => { window.showSaveFilePicker = () => { throw new Error('Agent processing must not save'); }; });
    const emso = await call(page, 'generate_emso', { count: 3, date: '1990-06-15', gender: 'female' });
    expect(emso.success).toBe(true);
    await expect(page.locator('#emso-output')).toHaveValue(emso.result.identifiers.join('\n'));
    await expect(page.locator('#emso-date')).toHaveValue('1990-06-15');
    const vat = await call(page, 'generate_si_tax_numbers', { count: 2, prefix: false });
    expect(vat.success).toBe(true); expect(vat.result.identifiers.every(value => /^\d{8}$/.test(value))).toBeTruthy();
    await expect(page.locator('#vat-output')).toHaveValue(vat.result.identifiers.join('\n'));
    const text = '{"private-demo-sentinel":9007199254740993,"n":-0,"n":1.2300}';
    const json = await call(page, 'format_json', { text, sortKeys: true, indent: 4 });
    await expect(page.locator('#json-output')).toHaveValue(json.result.text);
    await page.locator('#json-format').click();
    await expect(page.locator('#json-output')).toHaveValue(json.result.text);
    const segments = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from('{"sub":"private-demo-sentinel","exp":1}').toString('base64url')];
    const unsigned = segments.join('.');
    const token = unsigned + '.' + createHmac('sha256', 'test-secret').update(unsigned).digest('base64url');
    const jwt = await call(page, 'inspect_jwt', { token, verifySignature: true, key: 'test-secret' });
    expect(jwt.result.signature.valid).toBe(true); expect(jwt.result.claims.valid).toBe(false);
    await expect(page.locator('#jwt-signature-state')).toHaveText('VELJAVNO');
    await expect(page.locator('#jwt-time-state')).toHaveText('NEVELJAVNO');
    await page.locator('#jwt-parse').click();
    await expect(page.locator('#jwt-signature-state')).toHaveText('NI PREVERJEN');
    const conversion = await call(page, 'convert_sparkasse_csv', { text: csv + 'bad;Test;1,00;;warning\n' });
    expect(conversion.result.count).toBe(1); expect(conversion.warnings).toHaveLength(1);
    await expect(page.locator('#qif-output')).toHaveValue(conversion.result.qif);
    await expect(page.locator('#qif-source-text textarea')).toHaveValue(csv + 'bad;Test;1,00;;warning\n');
    await expect(page.locator('#qif-output-note')).toContainText('Preskočene napačne vrstice: 1.');
    const chunk = await call(page, 'read_artifact', { id: conversion.result.artifact.id });
    expect(Buffer.from(chunk.result.base64, 'base64').toString()).toBe(conversion.result.qif);
    await page.locator('.tool-nav [data-route=pdf]').click();
    await expect(page.locator('#pdf-file')).toBeEnabled();
    await page.locator('#pdf-file').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: await pdfBytes() });
    await expect(page.locator('#pdf-page-count')).toHaveText('2');
    const selected = await call(page, 'list_selected_files');
    const file = selected.result.files.find(file => file.tool === 'pdf');
    expect(file.pageCount).toBe(2);
    const composition = await call(page, 'compose_pdf', { filename: 'agent.pdf', pages: [{ fileId: file.id, page: 2, quarterTurns: 1 }, { fileId: file.id, page: 1 }, { fileId: file.id, page: 2, quarterTurns: 3 }] });
    expect(composition.success).toBe(true); expect(composition.result.pageCount).toBe(3);
    await expect(page.locator('#pdf-page-count')).toHaveText('3');
    await expect(page.locator('.pdf-page-rotation').first()).toHaveText('90°');
    const output = await call(page, 'read_artifact', { id: composition.result.artifact.id });
    const parsed = await PDFDocument.load(Buffer.from(output.result.base64, 'base64'));
    expect(parsed.getPageCount()).toBe(3); expect(parsed.getPage(0).getRotation().angle).toBe(90); expect(parsed.getPage(0).getWidth()).toBe(300); expect(parsed.getPage(2).getRotation().angle).toBe(270);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#pdf-artifact').click();
    const download = await downloadPromise;
    expect(await readFile(await download.path())).toEqual(Buffer.from(output.result.base64, 'base64'));
    await page.locator('.tool-nav [data-route=json]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tool-nav [data-route=pdf]').click();
    await expect(page.locator('#pdf-page-count')).toHaveText('3');
    await expect(page.locator('.pdf-page-rotation').first()).toHaveText('90°');
    await page.locator('#pdf-clear').click();
    expect((await call(page, 'read_artifact', { id: composition.result.artifact.id })).error.code).toBe('ARTIFACT_NOT_FOUND');
    expect((await call(page, 'list_selected_files')).result.files).toEqual([]);
    expect(requests.every(request => request.method === 'GET' && !request.body && !request.url.includes('private-demo-sentinel') && new URL(request.url).origin === 'http://127.0.0.1:8876')).toBeTruthy();
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test('native CSV selection shares conversion, warnings and artifact invalidation with agents', async ({ page }) => {
    await page.goto('/sparkasse-csv-qif/');
    await page.locator('#qif-file').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.locator('#qif-output-count')).toHaveText('1 TRANSAKCIJ');
    const manual = await page.locator('#qif-output').inputValue();
    const selected = (await call(page, 'list_selected_files')).result.files[0];
    const result = await call(page, 'convert_sparkasse_csv', { fileId: selected.id });
    expect(result.result.qif).toBe(manual);
    await page.locator('#qif-clear').click();
    expect((await call(page, 'read_artifact', { id: result.result.artifact.id })).error.code).toBe('ARTIFACT_NOT_FOUND');
    expect((await call(page, 'convert_sparkasse_csv', { fileId: selected.id })).error.code).toBe('FILE_NOT_FOUND');
});

test('every operation rejects malformed input visibly and handles cancelled calls', async ({ page }) => {
    await page.goto('/');
    for (const operation of OPERATIONS.filter(operation => operation.tool)) {
        const error = await call(page, operation.name, { unexpected: true });
        expect(error.error.code).toBe('INVALID_ARGUMENT');
        await expect(page.locator(`[data-panel="${operation.tool}"]`)).toBeVisible();
        await expect(page.locator('#' + operation.tool + '-status')).toHaveClass(/is-error/);
        const cancelled = await page.evaluate(({ name, input }) => {
            const controller = new AbortController(); controller.abort();
            return window.DelavnicaAgent.execute(name, input, { signal: controller.signal });
        }, { name: operation.name, input: operation.example });
        expect(cancelled.error.code).toBe('CANCELLED');
    }
});

test('WebMCP registers the current API with cancellation and same-origin defaults', async ({ page }) => {
    await page.addInitScript(() => {
        window.registered = [];
        Object.defineProperty(document, 'modelContext', { value: { registerTool: async (tool, options) => { window.registered.push({ tool, options }); } } });
    });
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const entry = window.registered.find(entry => entry.tool.name === 'format_json');
        const controller = new AbortController(); controller.abort();
        return { names: window.registered.map(entry => entry.tool.name), exposed: window.registered.some(entry => 'exposedTo' in entry.options),
            readOnly: entry.tool.annotations.readOnlyHint, untrusted: entry.tool.annotations.untrustedContentHint,
            success: JSON.parse(await entry.tool.execute({ text: '{"n":-0}' })), cancelled: JSON.parse(await entry.tool.execute({ text: '{}' }, { signal: controller.signal })) };
    });
    expect(result.names).toHaveLength(OPERATIONS.length); expect(result.exposed).toBe(false); expect(result.readOnly).toBe(false); expect(result.untrusted).toBe(true);
    expect(result.success.result.text).toContain('-0'); expect(result.cancelled.error.code).toBe('CANCELLED');
});

test('registration failure and missing WebMCP leave manual controls usable', async ({ page }) => {
    for (const enabled of [false, true]) {
        await page.addInitScript(enabled => { Object.defineProperty(document, 'modelContext', { configurable: true, value: enabled ? { registerTool: () => { throw new Error('Unavailable'); } } : undefined }); }, enabled);
        await page.goto('/json/');
        await page.locator('#json-input').fill('{"n":-0}');
        await page.locator('#json-format').click();
        await expect(page.locator('#json-output')).toHaveValue('{\n  "n": -0\n}');
    }
});

test('clearing slow CSV/PDF selections prevents asynchronous imports from restoring content', async ({ page }) => {
    await page.goto('/pdf/');
    await expect(page.locator('#pdf-file')).toBeEnabled();
    await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = function () {
            if (!this.name.startsWith('slow')) return original.call(this);
            window.slowStarted = true;
            return new Promise(resolve => { window.releaseSlowRead = async () => resolve(await original.call(this)); });
        };
    });
    await page.locator('#pdf-file').setInputFiles({ name: 'slow.pdf', mimeType: 'application/pdf', buffer: await pdfBytes() });
    await expect.poll(() => page.evaluate(() => !!window.slowStarted)).toBe(true);
    await expect(page.locator('#pdf-clear')).toBeEnabled();
    await page.locator('#pdf-clear').click();
    await page.evaluate(() => window.releaseSlowRead());
    await expect(page.locator('#pdf-page-count')).toHaveText('0');
    expect((await call(page, 'list_selected_files')).result.files).toEqual([]);
    await expect(page.locator('#pdf-file')).toBeEnabled();
    await page.locator('.tool-nav [data-route=qif]').click();
    await page.evaluate(() => { window.slowStarted = false; });
    await page.locator('#qif-file').setInputFiles({ name: 'slow.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect.poll(() => page.evaluate(() => !!window.slowStarted)).toBe(true);
    await page.locator('#qif-clear').click();
    await page.evaluate(() => window.releaseSlowRead());
    await expect(page.locator('#qif-output')).toHaveValue('');
    await expect(page.locator('#qif-artifact')).toHaveCount(0);
    expect((await call(page, 'list_selected_files')).result.files).toEqual([]);
});

test('manual PDF preparation still uses a second click to share and invalidates changed filenames', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'canShare', { value: () => true });
        Object.defineProperty(navigator, 'share', { value: async ({ files }) => { window.sharedName = files[0].name; } });
    });
    await page.goto('/pdf/'); await expect(page.locator('#pdf-file')).toBeEnabled();
    await page.locator('#pdf-file').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: await pdfBytes() });
    await expect(page.locator('#pdf-page-count')).toHaveText('2');
    await page.locator('#pdf-share').click();
    await expect(page.locator('#pdf-share')).toHaveText('DELI PDF');
    expect(await page.evaluate(() => window.sharedName)).toBeUndefined();
    const fileId = (await call(page, 'list_selected_files')).result.files[0].id;
    await call(page, 'compose_pdf', { filename: 'renamed.pdf', pages: [{ fileId, page: 1 }, { fileId, page: 2 }] });
    await expect(page.locator('#pdf-share')).toHaveText('PRIPRAVI ZA DELJENJE');
    await page.locator('#pdf-share').click();
    await expect(page.locator('#pdf-share')).toHaveText('DELI PDF');
    await page.locator('#pdf-share').click();
    expect(await page.evaluate(() => window.sharedName)).toBe('renamed.pdf');
});
