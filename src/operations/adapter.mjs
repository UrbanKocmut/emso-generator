import { API_VERSION, OPERATIONS } from './catalog.mjs';
import { fail, validateOperation } from './validation.mjs';
import { formatXml } from '../processing/xml.mjs';
import { generateJwt } from '../processing/jwt-generator.mjs';
import { resizeImages } from '../processing/images.mjs';

export function createAdapter({ core, files, artifacts, pdf, navigate = () => {}, appVersion, onInvalidate = () => {} }) {
    const definitions = new Map(OPERATIONS.map(operation => [operation.name, operation]));
    const controllers = new Map();
    const jobs = new Map();
    const tails = new Map();
    function invalidate(tool) {
        jobs.get(tool)?.abort();
        artifacts.clear(tool);
        onInvalidate(tool);
        controllers.get(tool)?.invalidate?.();
    }
    async function process(name, args, check) {
        if (name === 'format_xml') return { text: formatXml(args.text, args) };
        if (name === 'generate_jwt') return generateJwt(args, check);
        if (name === 'resize_images') return resizeImages(args, { files, artifacts, check, progress: update => { check(); controllers.get('image-resizer')?.fileProgress?.(update); } });
        if (name === 'generate_emso') {
            const identifiers = core.generateEmsos(args.count, { date: args.date ? core.parseIsoDate(args.date) : null, gender: args.gender, adultOnly: args.adultOnly });
            if (!identifiers.every(value => core.validateEmso(value).valid)) fail('PROCESSING_FAILED', 'Internal EMŠO checksum check failed.');
            return { identifiers, count: identifiers.length };
        }
        if (name === 'generate_si_tax_numbers') {
            const identifiers = core.generateSlovenianVats(args.count, { prefix: args.prefix });
            if (!identifiers.every(value => core.validateSlovenianVat(value).valid)) fail('PROCESSING_FAILED', 'Internal tax-number checksum check failed.');
            return { identifiers, count: identifiers.length, checksumScope: 'Slovenian eight-digit modulo 11 only; registration and VAT status unchecked.' };
        }
        if (name === 'format_json') return { text: core.formatJson(args.text, { indent: args.indent === 'tab' ? '\t' : args.indent, minify: args.minify, sortKeys: args.sortKeys }) };
        if (name === 'inspect_jwt') {
            const parsed = core.parseJwt(args.token);
            const result = { structure: { valid: true, algorithm: parsed.algorithm, header: parsed.header, payload: parsed.payload }, claims: core.analyzeJwtClaims(parsed.payload), signature: { state: 'unchecked', valid: null } };
            if (args.verifySignature) {
                try {
                    const verification = await core.verifyJwtSignature(parsed.token, args.key, { keyEncoding: args.keyEncoding });
                    check();
                    result.signature = { state: verification.valid ? 'valid' : 'invalid', ...verification, trust: 'supplied-key-only' };
                } catch (error) {
                    check();
                    result.signature = { state: 'error', valid: false, message: error.message, trust: 'supplied-key-only' };
                }
            }
            return result;
        }
        if (name === 'convert_sparkasse_csv') {
            let text = args.text;
            let encoding = 'text';
            let name = args.filename || 'sparkasse.qif';
            if (args.fileId) {
                const record = files.get(args.fileId, 'qif');
                const bytes = new Uint8Array(await record.file.arrayBuffer());
                check();
                const decoded = core.decodeTextBytes(bytes, args.csvEncoding);
                text = decoded.text; encoding = decoded.encoding;
                if (!args.filename) name = record.file.name.replace(/\.[^.]+$/, '') + '.qif';
            }
            const converted = core.convertSparkasseCsv(text, args);
            const bytes = core.encodeTextBytes(converted.qif, args.outputEncoding);
            check();
            const file = new File([bytes], /\.qif$/i.test(name) ? name : name + '.qif', { type: 'application/x-qif' });
            return { qif: converted.qif, count: converted.transactionCount, warnings: converted.warnings, warningCount: converted.warningCount, inputEncoding: encoding, artifact: artifacts.add(file, 'qif', { transactionCount: converted.transactionCount }) };
        }
        if (name === 'compose_pdf') {
            const composed = await pdf(args, check);
            check();
            return { pageCount: composed.pageCount, artifact: artifacts.add(composed.file, 'pdf', { pageCount: composed.pageCount }) };
        }
        if (name === 'list_selected_files') return { files: files.list() };
        if (name === 'read_artifact') return artifacts.read(args);
        fail('UNKNOWN_OPERATION', 'Unknown operation.');
    }
    function envelope(operation, result, error) {
        return { success: !error, operation, apiVersion: API_VERSION, appVersion, result: error ? null : result,
            warnings: error ? [] : result?.warnings || [], error: error ? { code: error.code || 'PROCESSING_FAILED', message: error.message || String(error) } : null };
    }
    function execute(name, input = {}, { signal, source = 'agent' } = {}) {
        const definition = definitions.get(name);
        if (!definition) return Promise.resolve(envelope(name, null, { code: 'UNKNOWN_OPERATION', message: 'Unknown operation.' }));
        const tool = definition.tool;
        let argumentsSnapshot;
        let argumentError;
        try { argumentsSnapshot = validateOperation(definition, input, core); }
        catch (error) { argumentError = error; }
        const job = new AbortController();
        const abort = () => job.abort();
        if (tool) { invalidate(tool); jobs.set(tool, job); }
        if (signal?.aborted) job.abort();
        else signal?.addEventListener('abort', abort, { once: true });
        function check() { if (job.signal.aborted) fail('CANCELLED', 'Operation cancelled or superseded.'); }
        const run = async () => {
            let controller = controllers.get(tool);
            try {
                check();
                if (tool && source !== 'manual') navigate(tool);
                if (argumentError) throw argumentError;
                const args = argumentsSnapshot;
                await controller?.apply?.(args, source);
                check();
                controller?.progress?.(args);
                // Yield before work so a same-turn clear/cancel can take effect.
                await Promise.resolve(); check();
                const result = await process(name, args, check);
                check();
                controller = controllers.get(tool);
                controller?.render?.(result, args);
                return envelope(name, result, null);
            } catch (error) {
                controller = controllers.get(tool);
                if (tool) { artifacts.clear(tool); onInvalidate(tool); }
                if (job.signal.aborted) error = { code: 'CANCELLED', message: 'Operation cancelled or superseded.' };
                else {
                    if (!error.code) error.code = ({ format_json: 'INVALID_JSON', inspect_jwt: 'INVALID_JWT', convert_sparkasse_csv: 'INVALID_CSV', compose_pdf: 'INVALID_PDF' })[name] || 'PROCESSING_FAILED';
                    controller?.error?.(error);
                }
                return envelope(name, null, error);
            } finally {
                signal?.removeEventListener('abort', abort);
                if (!tool || jobs.get(tool) === job) { controller?.settled?.(job.signal.aborted); jobs.delete(tool); }
            }
        };
        const promise = (tails.get(tool) || Promise.resolve()).then(run);
        if (tool) { tails.set(tool, promise); void promise.finally(() => { if (tails.get(tool) === promise) tails.delete(tool); }); }
        return promise;
    }
    return { execute, invalidate, whenIdle(tool) { return tails.get(tool) || Promise.resolve(); }, register(tool, controller) { controllers.set(tool, controller); }, dispose() { for (const tool of jobs.keys()) invalidate(tool); files.clear(); artifacts.clear(); } };
}
