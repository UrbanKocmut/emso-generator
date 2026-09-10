import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../assets/js/toolbox-core.js';
import { OPERATIONS, API_VERSION } from '../src/operations/catalog.mjs';
import { createAdapter } from '../src/operations/adapter.mjs';
import { createFileStore, createArtifactStore } from '../src/operations/session.mjs';

function harness(overrides = {}) {
    const files = createFileStore(); const artifacts = createArtifactStore();
    const rendered = []; const routes = [];
    const api = createAdapter({ core, files, artifacts, appVersion: 'test-version', navigate: tool => routes.push(tool), pdf: async () => ({ file: new File(['pdf'], 'test.pdf', { type: 'application/pdf' }), pageCount: 1 }), ...overrides });
    for (const tool of ['emso', 'vat', 'json', 'jwt', 'qif', 'pdf']) api.register(tool, { render: result => rendered.push({ tool, result }) });
    return { api, files, artifacts, rendered, routes };
}
const csv = OPERATIONS.find(op => op.name === 'convert_sparkasse_csv').example.text;

test('all operations return versioned envelopes and preserve text/validation scope', async () => {
    const h = harness();
    for (const name of ['generate_emso', 'generate_si_tax_numbers']) {
        const result = await h.api.execute(name, { count: 3 });
        assert.equal(result.success, true); assert.equal(result.apiVersion, API_VERSION); assert.equal(result.appVersion, 'test-version');
        assert.equal(result.result.identifiers.length, 3); assert.ok(result.result.identifiers.every(value => typeof value === 'string'));
    }
    const text = '{"n":9007199254740993,"n":-0,"a":1.2300}';
    assert.equal((await h.api.execute('format_json', { text, minify: true })).result.text, text);
    const jwt = await h.api.execute('inspect_jwt', OPERATIONS.find(op => op.name === 'inspect_jwt').example);
    assert.equal(jwt.result.signature.state, 'unchecked'); assert.equal(jwt.result.signature.valid, null);
    assert.ok(jwt.result.claims.checks.some(check => check.state === 'absent'));
    const qif = await h.api.execute('convert_sparkasse_csv', { text: csv + 'bad;Example;1,00;;Test\n' });
    assert.equal(qif.result.count, 1); assert.equal(qif.warnings.length, 1); assert.match(qif.result.qif, /T-12.34/);
    const pdf = await h.api.execute('compose_pdf', { pages: [{ fileId: 'file-1', page: 1 }] });
    assert.equal(pdf.result.pageCount, 1); assert.equal(pdf.result.artifact.mimeType, 'application/pdf');
    assert.equal((await h.api.execute('list_selected_files')).result.files.length, 0);
    h.api.dispose();
});

test('invalid arguments are rejected without coercion, including unknown fields and paths', async () => {
    const h = harness();
    for (const [name, input] of [
        ['generate_emso', { count: '3' }], ['generate_emso', { count: 0 }], ['generate_emso', { date: '2026-02-30' }], ['generate_emso', { date: '1990-01-01', adultOnly: true }], ['generate_si_tax_numbers', { prefix: 'false' }],
        ['format_json', { text: '{}', indent: 3 }], ['format_json', { text: {}, minify: true }], ['format_json', { text: '{}', url: 'https://example.test' }], ['inspect_jwt', { token: 'x', verifySignature: true }],
        ['convert_sparkasse_csv', { text: csv, fileId: 'file-1' }], ['convert_sparkasse_csv', { text: csv, filename: '../x.qif' }], ['convert_sparkasse_csv', { text: csv, inputDateFormat: '%H' }],
        ['compose_pdf', { pages: [{ fileId: 'file-1', page: 0 }] }], ['compose_pdf', { pages: [{ fileId: 'file-1', page: 1, quarterTurns: 90 }] }]
    ]) { const result = await h.api.execute(name, input); assert.equal(result.success, false, name); assert.equal(result.error.code, 'INVALID_ARGUMENT', JSON.stringify(input)); }
    for (const [name, input, code] of [['format_json', { text: '{' }, 'INVALID_JSON'], ['inspect_jwt', { token: 'bad' }, 'INVALID_JWT'], ['convert_sparkasse_csv', { text: 'bad' }, 'INVALID_CSV'], ['convert_sparkasse_csv', { fileId: '/etc/passwd' }, 'FILE_NOT_FOUND']]) assert.equal((await h.api.execute(name, input)).error.code, code);
    assert.equal(h.rendered.length, 0);
    h.api.dispose();
});

test('artifact chunks are bounded, exact, session local and invalidated', async () => {
    const h = harness();
    const input = new Uint8Array(70000).map((_, index) => index % 256);
    const metadata = h.artifacts.add(new File([input], 'fixture.bin'), 'pdf');
    const first = await h.api.execute('read_artifact', { id: metadata.id });
    const second = await h.api.execute('read_artifact', { id: metadata.id, offset: first.result.nextOffset });
    assert.equal(first.result.bytesRead, 65536); assert.equal(second.result.eof, true);
    assert.deepEqual(Buffer.concat([Buffer.from(first.result.base64, 'base64'), Buffer.from(second.result.base64, 'base64')]), Buffer.from(input));
    assert.equal((await h.api.execute('read_artifact', { id: metadata.id, length: 65537 })).error.code, 'INVALID_ARGUMENT');
    h.api.invalidate('pdf');
    assert.equal((await h.api.execute('read_artifact', { id: metadata.id })).error.code, 'ARTIFACT_NOT_FOUND');
    h.api.dispose();
});

test('superseding, clearing and cancelling slow reads cannot publish stale output', async () => {
    for (const action of ['supersede', 'clear', 'cancel']) {
        const h = harness(); let release; let started;
        const reading = new Promise(resolve => { started = resolve; });
        const file = { name: 'slow.csv', type: 'text/csv', size: 10, arrayBuffer: () => { started(); return new Promise(resolve => { release = resolve; }); } };
        const id = h.files.add(file, 'qif'); const controller = new AbortController();
        const slow = h.api.execute('convert_sparkasse_csv', { fileId: id }, { signal: controller.signal });
        await reading;
        let next;
        if (action === 'supersede') next = h.api.execute('convert_sparkasse_csv', { text: csv });
        if (action === 'clear') { h.api.invalidate('qif'); h.files.clear('qif'); }
        if (action === 'cancel') controller.abort();
        release(new TextEncoder().encode(csv).buffer);
        assert.equal((await slow).error.code, 'CANCELLED');
        if (next) assert.equal((await next).success, true);
        assert.equal(h.rendered.length, next ? 1 : 0);
        h.api.dispose();
    }
});

test('same-token verification with an edited key cannot publish an old signature result', async () => {
    let resolveVerification; const pending = new Promise(resolve => { resolveVerification = resolve; });
    let entered; const enteredPromise = new Promise(resolve => { entered = resolve; });
    const h = harness({ core: { ...core, verifyJwtSignature: async () => { entered(); return pending; } } });
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vIn0.c2ln';
    const first = h.api.execute('inspect_jwt', { token, verifySignature: true, key: 'old' });
    await enteredPromise;
    h.api.invalidate('jwt');
    resolveVerification({ valid: true, algorithm: 'HS256' });
    assert.equal((await first).error.code, 'CANCELLED'); assert.equal(h.rendered.length, 0);
    h.api.dispose();
});

test('cancellation at the artifact publication boundary revokes the unpublished output', async () => {
    const h = harness(); const controller = new AbortController(); let metadata;
    const add = h.artifacts.add.bind(h.artifacts);
    h.artifacts.add = (...args) => { metadata = add(...args); controller.abort(); return metadata; };
    const result = await h.api.execute('convert_sparkasse_csv', { text: csv }, { signal: controller.signal });
    assert.equal(result.error.code, 'CANCELLED'); assert.equal(h.rendered.length, 0);
    assert.equal((await h.api.execute('read_artifact', { id: metadata.id })).error.code, 'ARTIFACT_NOT_FOUND');
    h.api.dispose();
});
