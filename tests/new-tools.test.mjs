import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { unzipSync } from 'fflate';
import { generateJwt, decodeSecret, randomSecret, localDateTime, unixSeconds, HMAC } from '../src/processing/jwt-generator.mjs';
import { xmlTokens, formatXml } from '../src/processing/xml.mjs';
import { imageHeader, resizeDimensions, outputFilename, resizeImages, imageZip } from '../src/processing/images.mjs';
import { createFileStore, createArtifactStore } from '../src/operations/session.mjs';
import { LIMITS } from '../src/operations/catalog.mjs';

test('JWT signatures match independent Node HMAC for every algorithm and Unicode claims', async () => {
    for (const [algorithm, { bytes }] of Object.entries(HMAC)) {
        for (const secretEncoding of ['text', 'base64']) {
            const secret = secretEncoding === 'text' ? 'Ž'.repeat(bytes / 2) : randomSecret(algorithm);
            const result = await generateJwt({ algorithm, secret, secretEncoding, issuer: 'izdajatelj', subject: 'Žiga 😃', audience: 'test', issuedAt: '2026-09-10T12:00:01', customClaims: '{"vloga":"član","nested":{"exp":1},"__proto__":{"safe":true}}' });
            const [header, payload, signature] = result.token.split('.');
            assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: algorithm, typ: 'JWT' });
            assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), result.payload);
            assert.equal(result.payload.sub, 'Žiga 😃'); assert.equal(result.payload.iat, unixSeconds('2026-09-10T12:00:01'));
            assert.equal(signature, createHmac('sha' + algorithm.slice(2), decodeSecret(secret, secretEncoding)).update(header + '.' + payload).digest('base64url'));
            assert.equal(Object.hasOwn(result.payload, 'exp'), false);
        }
        await assert.rejects(generateJwt({ algorithm, secret: 'a'.repeat(bytes - 1) }), /najmanj/);
    }
});
test('JWT encoding, claim conflicts and timestamps reject ambiguity', async () => {
    const raw = Buffer.alloc(48, 255);
    assert.deepEqual(Buffer.from(decodeSecret(raw.toString('base64url'), 'base64')), raw);
    assert.deepEqual(Buffer.from(decodeSecret(' ' + raw.toString('base64') + '\n', 'base64')), raw);
    for (const value of ['A', 'ab==', 'YWJj=', 'a+a_', 'YW Jj', '####']) assert.throws(() => decodeSecret(value, 'base64'));
    const args = { secret: 'a'.repeat(32) };
    for (const customClaims of ['[]', 'null', 'true', '{', ...['iss', 'sub', 'aud', 'iat', 'nbf', 'exp'].map(key => JSON.stringify({ [key]: 1 }))]) await assert.rejects(generateJwt({ ...args, customClaims }));
    for (const value of ['2026-02-30T12:00', '2026-01-01T25:00', 'bad', '2026-01-01T12:00Z']) assert.throws(() => unixSeconds(value));
    assert.equal(unixSeconds('1970-01-01T00:00:00'), new Date('1970-01-01T00:00:00').getTime() / 1000);
    assert.equal(localDateTime(new Date('2026-09-10T12:00:01')), '2026-09-10T12:00:01');
    assert.deepEqual((await generateJwt(args)).payload, {});
    await assert.rejects(generateJwt(args, () => { throw new Error('cancelled'); }), /cancelled/);
    let abort = false;
    const crypto = { subtle: { importKey: async () => ({}), sign: async () => { abort = true; return new ArrayBuffer(32); } } };
    await assert.rejects(generateJwt(args, () => { if (abort) throw new Error('cancelled'); }, crypto), /cancelled/);
});
test('XML lexical scan excludes declarations before the parser and respects quoted delimiters', () => {
    for (const text of ['<!DOCTYPE x SYSTEM "https://example.test/x"><x/>', '<!ENTITY x "hello"><x/>', '<r><!DOCTYPE x></r>']) {
        let called = false;
        assert.throws(() => formatXml(text, {}, class { constructor() { called = true; } }), /DTD/);
        assert.equal(called, false);
    }
    const text = '<r x="> / &lt;"> <!-- <!DOCTYPE fake> --> <![CDATA[<x>]]> <?p ?> </r>';
    assert.deepEqual(xmlTokens(text).map(token => text.slice(token.start, token.end)).join(''), text);
    assert.throws(() => formatXml('x'.repeat(LIMITS.textCharacters + 1)), /16 MiB/);
});
test('image calculations preserve fit, enlargement, rounding and hard output bounds', () => {
    assert.deepEqual(resizeDimensions(4000, 2000), { width: 1920, height: 960 });
    assert.deepEqual(resizeDimensions(100, 200), { width: 100, height: 200 });
    assert.deepEqual(resizeDimensions(100, 200, { enlarge: true }), { width: 540, height: 1080 });
    assert.deepEqual(resizeDimensions(403, 201, { mode: 'percentage', percentage: 25 }), { width: 101, height: 50 });
    assert.deepEqual(resizeDimensions(1, 100, { mode: 'percentage', percentage: 1 }), { width: 1, height: 1 });
    for (const args of [{ mode: 'percentage', percentage: 401 }, { maxWidth: 8193 }, { mode: 'percentage', percentage: 400 }]) assert.throws(() => resizeDimensions(4000, 4000, args));
    assert.throws(() => resizeDimensions(10000, 4001), /40 milijonov/);
    assert.throws(() => resizeDimensions(9000, 1, { mode: 'percentage' }), /8192/);
});
test('image dimension preflight rejects corrupt and oversized data before decoding', () => {
    const png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write('IHDR',12); png.writeUInt32BE(10000,16); png.writeUInt32BE(4001,20);
    assert.throws(() => imageHeader(png), /40 milijonov/);
    png.writeUInt32BE(40,20); assert.deepEqual(imageHeader(png), { width: 10000, height: 40, mimeType: 'image/png' });
    assert.throws(() => imageHeader(new Uint8Array([255, 216, 255, 192, 255, 255])));
    assert.throws(() => imageHeader(new Uint8Array()));
});
test('batch partial success, safe duplicate filenames and ZIP bytes round-trip', async () => {
    const files = createFileStore(), artifacts = createArtifactStore(), used = new Set();
    assert.equal(outputFilename('../A.png', 'image/png', used), '.._A.png');
    assert.equal(outputFilename('CON.jpg', 'image/jpeg', used), '_CON.jpg');
    const fileIds = ['same.png', 'bad.png', 'same.jpg', 'SAME.png'].map(name => files.add(new File(['original'], name), 'image-resizer'));
    let concurrent = 0, peak = 0;
    const result = await resizeImages({ fileIds }, { files, artifacts, resize: async file => {
        peak = Math.max(peak, ++concurrent); await new Promise(resolve => setTimeout(resolve, 1)); concurrent--;
        if (file.name === 'bad.png') throw new Error('corrupt');
        return { blob: new Blob([file.name]), mimeType: 'image/png', width: 2, height: 1 };
    } });
    assert.equal(peak, 1); assert.equal(result.count, 3); assert.equal(result.images[1].success, false);
    const archive = unzipSync(new Uint8Array(await artifacts.getFile(result.zipArtifact.id).arrayBuffer()));
    assert.deepEqual(Object.keys(archive), ['same.png', 'same (2).png', 'SAME (3).png']);
    assert.equal(new TextDecoder().decode(archive['same (2).png']), 'same.jpg');
    artifacts.clear(); files.clear();
});
test('ZIP failure retains individual artifacts and cancellation interrupts chunking', async () => {
    const files = createFileStore(), revoked = [], artifacts = createArtifactStore({ createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) });
    const id = files.add(new File(['x'], 'x.png'), 'image-resizer');
    const result = await resizeImages({ fileIds: [id] }, { files, artifacts, resize: async () => ({ blob: new Blob(['ok']), mimeType: 'image/png', width: 1, height: 1 }), zip: async () => { throw new Error('zip failed'); } });
    assert.equal(result.zipArtifact, null); assert.equal(result.warnings.length, 1);
    assert.equal(await artifacts.getFile(result.images[0].artifact.id).text(), 'ok');
    let checks = 0;
    await assert.rejects(imageZip([new File([new Uint8Array(3 * 1024 * 1024)], 'big.png')], () => { if (++checks === 3) throw new Error('cancel'); }), /cancel/);
    artifacts.clear(); assert.equal(revoked.length, 1);
});
