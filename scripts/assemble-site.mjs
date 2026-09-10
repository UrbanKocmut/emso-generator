import { readFile } from 'node:fs/promises';
import tools from '../assets/js/tool-registry.js';
import { help } from '../src/html/help.mjs';
import { structuredData, PUBLIC_ORIGIN } from '../src/metadata.mjs';
import { OPERATIONS, API_VERSION, LIMITS, ERROR_CODES } from '../src/operations/catalog.mjs';

export const cssSources = ['shared', 'desktop-tablet', 'mobile-landscape', 'standalone', 'mobile-standalone', 'accessibility-print', 'help', 'new-tools'];
const read = async path => (await readFile(new URL('../' + path, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function navigation() {
    return tools.map((tool, index) => `<a class="tool-nav-link" href="${tool.path}" data-route="${tool.id}"><span class="tool-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.subtitle)}</small></span><span aria-hidden="true">↗</span></a>`).join('');
}

export function cards() {
    return tools.map((tool, index) => `<a class="tool-card${tool.inverted ? ' inverted' : ''}" href="${tool.path}" data-route="${tool.id}"><span class="card-index">${String(index + 1).padStart(2, '0')} / ${escapeHtml(tool.category)}</span><span class="card-symbol" aria-hidden="true">${escapeHtml(tool.symbol)}</span><span class="card-title">${tool.cardTitle.map(escapeHtml).join('<br>')}</span><span class="card-description">${escapeHtml(tool.description)}</span><span class="card-action">ODPRI ORODJE <span aria-hidden="true">→</span></span></a>`).join('');
}

function helpHtml(id) {
    return `<section class="reference-panel tool-help" aria-labelledby="${id}-help"><h2 class="panel-label" id="${id}-help">UPORABA IN POMOČ</h2><div class="reference-content">${help[id].map(([title, body]) => `<div class="reference-copy"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join('')}<div class="reference-copy"><a href="agents/">Navodila za agente (English)</a> · <a href="./" data-route="overview">Vsa orodja</a></div></div></section>`;
}

export async function assembleSite() {
    const panels = await Promise.all(['overview', ...tools.map(t => t.id)].map(async id => {
        const panel = await read(`src/html/panels/${id}.html`);
        const explanation = helpHtml(id);
        if (id === 'emso' || id === 'vat') {
            // Expand the existing reference section, after its original content.
            return panel.replace('            </section>', explanation.replace(/^<section[^>]+>/, '<div class="tool-help">').replace(/<\/section>$/, '</div>') + '\n            </section>');
        }
        return panel.replace(/        <\/section>\s*$/, explanation + '\n        </section>\n');
    }));
    let html = (await read('src/html/shell.html')).replace('{{PANELS}}', panels.join('\n').trimEnd()).replace('{{TOOL_COUNTS}}', `--tool-count:${tools.length};--tool-route-count:${tools.length + 1}`);
    html = html.replace('</nav>', navigation() + '</nav>')
        .replace('<span id="tool-count"></span>', `<span id="tool-count">${String(tools.length).padStart(2, '0')}</span>`)
        .replace('<div class="overview-grid" aria-label="Razpoložljiva orodja"></div>', `<div class="overview-grid" aria-label="Razpoložljiva orodja">${cards()}</div>`);
    const outputs = new Map([['assets/css/toolbox.css', (await Promise.all(cssSources.map(name => read(`src/css/${name}.css`)))).join('')]]);
    for (const page of [tools.overview, ...tools]) {
        let entry = html.replace(/<section class="tool-panel[^>]*data-panel="([^"]+)"[^>]*>/g, (tag, id) => tag.replace(/ hidden/g, ''));
        entry = entry.replace(/<section class="tool-panel[^>]*data-panel="([^"]+)"[^>]*>/g, (tag, id) => id === page.id ? tag : tag.slice(0, -1) + ' hidden>');
        entry = entry.replace('<title>Delavnica</title>', '<title>' + escapeHtml(page.pageTitle) + '</title>');
        entry = entry.replace(/(<meta name="description" content=")[^"]*/, '$1' + escapeHtml(page.description));
        entry = entry.replace(/(<meta property="og:title" content=")[^"]*/, '$1' + escapeHtml(page.pageTitle));
        entry = entry.replace(/(<meta property="og:description" content=")[^"]*/, '$1' + escapeHtml(page.description));
        entry = entry.replaceAll('https://delavnica.kocmut.com/', 'https://delavnica.kocmut.com/' + page.path);
        entry = entry.replace('</head>', '<script id="app-structured-data" type="application/ld+json">' + JSON.stringify(structuredData(page)).replaceAll('<', '\\u003c') + '</script>\n</head>');
        entry = entry.replace(/href="#overview"/g, 'href="./" data-route="overview"');
        entry = entry.replaceAll('data-route="overview" data-route="overview"', 'data-route="overview"');
        entry = entry.replace(/<a([^>]*data-route="([^"]+)"[^>]*)>/g, (tag, attributes, id) => id === page.id ? '<a' + attributes + ' aria-current="page">' : tag);
        if (page.id !== 'overview') entry = entry.replace('id="mobile-info-hint"', 'id="mobile-info-hint" hidden');
        if (page.path) entry = entry.replace(/(href|src)="(?!#|[a-z]+:|\/)([^"]+)"/g, '$1="../$2"');
        outputs.set(page.path + 'index.html', entry);
    }
    const operationDocs = OPERATIONS.map(operation => `<section id="${operation.name}"><h2><code>${operation.name}</code></h2><p>${escapeHtml(operation.description)}</p><p>${operation.tool ? `<a href="../${tools.find(tool => tool.id === operation.tool).path}">Open workspace</a> · ` : ''}${operation.readOnly ? 'Reads local session state.' : 'Updates the visible workspace.'}</p><h3>Example input</h3><pre>${escapeHtml(JSON.stringify(operation.example, null, 2))}</pre><details><summary>Input schema and defaults</summary><pre>${escapeHtml(JSON.stringify(operation.inputSchema, null, 2))}</pre></details></section>`).join('\n');
    outputs.set('agents/index.html', (await read('src/html/agents.html')).replace('{{API_VERSION}}', API_VERSION).replace('{{OPERATIONS}}', operationDocs).replace('{{ERROR_CODES}}', ERROR_CODES.map(code => `<code>${code}</code>`).join(', ')));
    outputs.set('tools.json', JSON.stringify({ apiVersion: API_VERSION, appVersion: '__DELAVNICA_APP_VERSION__', documentation: PUBLIC_ORIGIN + 'agents/', pages: [tools.overview, ...tools].map(page => ({ id: page.id, url: PUBLIC_ORIGIN + page.path, title: page.pageTitle, description: page.description })), limits: LIMITS, errorCodes: ERROR_CODES, operations: OPERATIONS }, null, 2) + '\n');
    outputs.set('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + PUBLIC_ORIGIN + 'sitemap.xml\n');
    outputs.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ['', ...tools.map(tool => tool.path), 'agents/', 'zasebnost.html'].map(path => '  <url><loc>' + PUBLIC_ORIGIN + path + '</loc></url>').join('\n') + '\n</urlset>\n');
    outputs.set('llms.txt', '# Delavnica\n\nStatic, browser-local tools. No remote processing API. Agent/provider privacy is separate from site-local processing.\n\n- [Agent guide](' + PUBLIC_ORIGIN + 'agents/)\n- [Versioned schemas and catalog](' + PUBLIC_ORIGIN + 'tools.json)\n' + tools.map(tool => `- [${tool.title}](${PUBLIC_ORIGIN}${tool.path})`).join('\n') + '\n');
    return outputs;
}
