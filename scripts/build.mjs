import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build, version as esbuildVersion } from 'esbuild';
import { canonicalRuntimeContent, generatePrecache, projectRoot } from './generate-precache.mjs';
import { assembleSite } from './assemble-site.mjs';
import { createHash } from 'node:crypto';

const check = process.argv.includes('--check');
// New entry pages can be opened while the previous worker still owns the tab.
// That worker ignores query strings, so retain original URLs and also emit
// migration paths for assets whose old versions cannot run the new HTML.
const migrationAssets = new Map([
    ['assets/css/toolbox.css', 'assets/v2/toolbox.css'],
    ...['tool-registry', 'pdf-loader', 'toolbox-ui', 'pwa', 'pdf-merger'].map(name => ['assets/js/' + name + '.js', 'assets/v2/' + name + '.js'])
]);
async function contentVersion(outputs) {
    const hash = createHash('sha256');
    const files = [];
    async function visit(relative) {
        const entries = await fs.readdir(path.join(projectRoot, relative), { withFileTypes: true });
        for (const entry of entries) {
            const name = relative + '/' + entry.name;
            if (entry.isDirectory()) await visit(name);
            else if (!outputs.has(name)) files.push(name);
        }
    }
    await visit('assets');
    await visit('src');
    await visit('fonts');
    if (await fs.stat(path.join(projectRoot, 'sprites')).catch(() => null)) await visit('sprites');
    files.push('service-worker.js', 'manifest.webmanifest');
    for (const name of files.sort()) hash.update(name + '\0').update(canonicalRuntimeContent(name, await fs.readFile(path.join(projectRoot, name))));
    for (const [name, value] of [...outputs].sort(([a], [b]) => a.localeCompare(b, 'en'))) hash.update(name + '\0' + value);
    return hash.digest('hex');
}
async function bundle(entry, minify) {
    const result = await build({ entryPoints: [path.join(projectRoot, entry)], bundle: true,
        charset: 'ascii', format: 'iife', legalComments: 'none', logLevel: 'silent',
        minify, platform: 'browser', write: false });
    if (result.outputFiles.length !== 1) throw new Error('Expected one browser bundle.');
    return result.outputFiles[0].text.replaceAll('` \n`', '`\\x20\n`');
}

async function main() {
    if (esbuildVersion !== '0.28.1') throw new Error('Expected esbuild 0.28.1.');
    const outputs = await assembleSite();
    outputs.set('assets/js/pdf-merger.js', await bundle('assets/js/pdf-merger.mjs', true));
    outputs.set('assets/js/toolbox-ui.js', await bundle('src/ui/bootstrap.mjs', false));
    for (const [original, alias] of migrationAssets) {
        outputs.set(alias, outputs.get(original) ?? (await fs.readFile(path.join(projectRoot, original), 'utf8')).replaceAll('\r\n', '\n'));
    }
    for (const [name, content] of outputs) if (name.endsWith('.html')) {
        let html = content;
        for (const [original, alias] of migrationAssets) html = html.replaceAll(original, alias);
        outputs.set(name, html);
    }
    const version = await contentVersion(outputs);
    for (const [relativePath, template] of outputs) {
        const expected = template.replaceAll('__DELAVNICA_APP_VERSION__', version);
        const target = path.join(projectRoot, relativePath);
        if (check) {
            const actual = await fs.readFile(target, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
            if (actual.replaceAll('\r\n', '\n') !== expected) throw new Error(relativePath + ' is stale. Run npm run build.');
        } else {
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, expected);
        }
    }
    await generatePrecache({ check });
    console.log(check ? 'Build outputs are current.' : 'Build outputs updated.');
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
