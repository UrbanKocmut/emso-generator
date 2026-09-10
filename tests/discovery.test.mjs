import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import tools from '../assets/js/tool-registry.js';
import { OPERATIONS, API_VERSION } from '../src/operations/catalog.mjs';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('discovery lists public pages, unrestricted crawlers and accurate operation schemas', async () => {
    const catalog = JSON.parse(await read('tools.json'));
    assert.equal(catalog.apiVersion, API_VERSION);
    assert.deepEqual(catalog.operations, OPERATIONS);
    assert.match(catalog.appVersion, /^[a-f0-9]{64}$/);
    const docs = await read('agents/index.html');
    assert.ok(docs.includes(catalog.appVersion));
    for (const op of OPERATIONS) assert.ok(docs.includes('id="' + op.name + '"'));
    const sitemap = await read('sitemap.xml');
    for (const route of ['', ...tools.map(t => t.path), 'agents/', 'zasebnost.html']) assert.ok(sitemap.includes('<loc>https://delavnica.kocmut.com/' + route + '</loc>'));
    assert.doesNotMatch(sitemap, /lastmod|#|\/assets\/|\/tests\//);
    assert.equal(await read('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://delavnica.kocmut.com/sitemap.xml\n');
    for (const page of [tools.overview, ...tools]) {
        const html = await read(page.path + 'index.html');
        assert.ok(html.includes('<title>' + page.pageTitle + '</title>'));
        const structured = JSON.parse(html.match(/id="app-structured-data"[^>]*>(.*?)<\/script>/s)[1]);
        assert.equal(structured['@type'], 'WebApplication');
        assert.equal(structured.url, 'https://delavnica.kocmut.com/' + page.path);
        assert.ok(html.includes('id="' + page.id + '-help"'));
        assert.doesNotMatch(html, /data-route="([^"]+)" data-route=/);
    }
});
