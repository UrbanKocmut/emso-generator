import { LIMITS } from '../operations/catalog.mjs';
import { failLocal as fail } from '../operations/validation.mjs';

// Scan lexical tokens before invoking DOMParser: declarations must never reach it.
// Quotes, comments, CDATA and processing instructions can contain delimiters.
export function xmlTokens(text) {
    const tokens = [];
    let offset = 0;
    while (offset < text.length) {
        const start = offset;
        let kind = 'text';
        if (text[offset] !== '<') {
            offset = text.indexOf('<', offset);
            if (offset < 0) offset = text.length;
        } else {
            const endMarker = text.startsWith('<!--', offset) ? '-->' : text.startsWith('<![CDATA[', offset) ? ']]>' : text.startsWith('<?', offset) ? '?>' : null;
            if (endMarker) {
                kind = endMarker === ']]>' ? 'cdata' : 'markup';
                const end = text.indexOf(endMarker, offset + (endMarker === '-->' ? 4 : endMarker === ']]>' ? 9 : 2));
                if (end < 0) fail('INVALID_XML', 'XML vsebuje nezaključen komentar, CDATA ali navodilo.');
                offset = end + endMarker.length;
            } else {
                if (text.startsWith('<!', offset)) fail('INVALID_XML', 'Deklaracije DTD in entitet niso dovoljene.');
                kind = text.startsWith('</', offset) ? 'close' : 'open';
                let quote = '';
                for (offset++; offset < text.length; offset++) {
                    const c = text[offset];
                    if (quote) { if (c === quote) quote = ''; }
                    else if (c === '"' || c === "'") quote = c;
                    else if (c === '>') break;
                }
                if (offset === text.length) fail('INVALID_XML', 'XML vsebuje nezaključeno oznako.');
                offset++;
                if (kind === 'open' && text[offset - 2] === '/') kind = 'empty';
            }
        }
        tokens.push({ kind, start, end: offset });
    }
    return tokens;
}

export function formatXml(text, { indent = 2 } = {}, Parser = globalThis.DOMParser) {
    if (typeof text !== 'string' || text.length > LIMITS.textCharacters) fail('LIMIT_EXCEEDED', 'XML lahko vsebuje največ 16 MiB znakov.');
    if (![2, 4, 'tab'].includes(indent)) fail('INVALID_ARGUMENT', 'Izberite 2 ali 4 presledke oziroma tabulator.');
    const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
    if (bom) text = text.slice(1);
    const tokens = xmlTokens(text);
    if (!Parser) fail('PROCESSING_FAILED', 'Razčlenjevalnik XML v tem brskalniku ni na voljo.');
    const parser = new Parser();
    let doc = parser.parseFromString(text, 'application/xml');
    const hasError = value => !value.documentElement || ['http://www.mozilla.org/newlayout/xml/parsererror.xml', 'http://www.w3.org/1999/xhtml'].some(namespace => value.getElementsByTagNameNS(namespace, 'parsererror').length);
    if (hasError(doc)) {
        // A valid source can itself use the name "parsererror". Recheck with
        // only those element names renamed; DTDs are excluded, so this does not
        // change well-formedness or any attribute/xml:space interpretation.
        const probe = tokens.map(token => {
            const raw = text.slice(token.start, token.end);
            return ['open', 'empty', 'close'].includes(token.kind) ? raw.replace(/^(<\/?)([^\s/>]+)/, (all, prefix, name) => name.split(':').at(-1) === 'parsererror' ? prefix + name.replace(/parsererror$/, 'delavnica-xml-validation') : all) : raw;
        }).join('');
        if (probe !== text) doc = parser.parseFromString(probe, 'application/xml');
    }
    if (hasError(doc)) {
        fail('INVALID_XML', 'XML ni veljaven. Preverite oznake, atribute in imenske prostore.');
    }
    const elements = doc.getElementsByTagName('*');
    let elementIndex = 0;
    const root = { children: [], start: 0, end: text.length, preserve: false };
    const stack = [root];
    for (const token of tokens) {
        const parent = stack.at(-1);
        if (token.kind === 'close') {
            const node = stack.pop();
            node.close = token.start; node.end = token.end;
        } else {
            const node = { ...token };
            parent.children.push(node);
            if (token.kind === 'open' || token.kind === 'empty') {
                const space = elements[elementIndex++].getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space');
                node.preserve = space === 'preserve' || (space !== 'default' && parent.preserve);
                node.children = [];
                parent.hasElements = true;
                if (token.kind === 'open') { node.openEnd = token.end; stack.push(node); }
            } else if (token.kind === 'cdata' || (token.kind === 'text' && /[^\x20\t\r\n]/.test(text.slice(token.start, token.end)))) parent.mixed = true;
        }
    }
    const unit = indent === 'tab' ? '\t' : ' '.repeat(indent);
    const output = [];
    let length = 0;
    const append = value => {
        length += value.length;
        if (length > LIMITS.textCharacters) fail('LIMIT_EXCEEDED', 'Oblikovan XML presega omejitev 16 MiB znakov.');
        output.push(value);
    };
    // Iterative traversal also avoids a JavaScript stack overflow for deep XML.
    const work = [{ node: root, depth: -1 }];
    while (work.length) {
        const { node, depth, closing } = work.pop();
        if (closing) { append('\n' + unit.repeat(depth) + text.slice(node.close, node.end)); continue; }
        if (node !== root) append((output.length ? '\n' : '') + unit.repeat(depth));
        if (node !== root && (node.kind !== 'open' || node.preserve || node.mixed || !node.hasElements)) {
            append(text.slice(node.start, node.end)); continue;
        }
        if (node !== root) {
            append(text.slice(node.start, node.openEnd));
            work.push({ node, depth, closing: true });
        }
        const children = node.children.filter(child => child.kind !== 'text' || /[^\x20\t\r\n]/.test(text.slice(child.start, child.end)));
        for (let i = children.length - 1; i >= 0; i--) work.push({ node: children[i], depth: depth + 1 });
    }
    return bom + output.join('');
}
