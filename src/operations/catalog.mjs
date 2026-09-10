export const API_VERSION = '1.0.0';
export const LIMITS = Object.freeze({ textCharacters: 16 * 1024 * 1024, fileBytes: 64 * 1024 * 1024, sessionFileBytes: 128 * 1024 * 1024, artifactBytes: 128 * 1024 * 1024, chunkBytes: 65536, pages: 5000 });
const string = (maxLength = LIMITS.textCharacters) => ({ type: 'string', maxLength });
const boolean = defaultValue => ({ type: 'boolean', default: defaultValue });
const enumeration = (values, defaultValue = values[0]) => ({ type: 'string', enum: values, default: defaultValue });
const count = { type: 'integer', minimum: 1, maximum: 5000, default: 10 };
const fileId = { ...string(80), minLength: 1 };
const filename = { ...string(180), minLength: 1, pattern: '^[^<>:"/\\\\|?*\\u0000-\\u001f]+$' };
const dateFormat = { ...string(32), minLength: 1, default: '%d.%m.%Y' };
const schema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
export const OPERATIONS = [
    { name: 'generate_emso', tool: 'emso', description: 'Generate synthetic Slovenian EMŠO strings in the visible workspace. Checksums only; no population-register lookup or proof that an identifier is unassigned.',
        inputSchema: schema({ count, date: { ...string(10), default: '' }, gender: enumeration(['random', 'male', 'female']), adultOnly: boolean(false) }),
        example: { count: 3, date: '1990-06-15', gender: 'female' } },
    { name: 'generate_si_tax_numbers', tool: 'vat', description: 'Generate synthetic eight-digit Slovenian tax-number strings with an optional SI prefix. Validates modulo-11 checksums, not registration or VAT status.',
        inputSchema: schema({ count, prefix: boolean(true) }), example: { count: 3, prefix: true } },
    { name: 'format_json', tool: 'json', description: 'Format original JSON text in the visible workspace, preserving numeric spelling, duplicate keys and string escapes. Returns text; optional stable object-key sorting.',
        inputSchema: schema({ text: string(), indent: { enum: [2, 4, 'tab'], default: 2 }, minify: boolean(false), sortKeys: boolean(false) }, ['text']),
        example: { text: '{"n":9007199254740993,"n":-0}', indent: 2 } },
    { name: 'inspect_jwt', tool: 'jwt', description: 'Decode a JWT, check its time claims and optionally verify its signature with a supplied HMAC secret or SPKI public key. Returns separate structure, claims and signature states. Supplied-key verification does not establish issuer trust.',
        inputSchema: schema({ token: string(), verifySignature: boolean(false), key: { ...string(), default: '' }, keyEncoding: enumeration(['text', 'base64']) }, ['token']),
        example: { token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0.' } },
    { name: 'convert_sparkasse_csv', tool: 'qif', description: 'Convert local Sparkasse CSV text or a selected CSV file ID into QIF. Exactly one source is required. Shows conversion warnings and returns a local artifact; never saves, shares or uploads automatically.',
        inputSchema: { ...schema({ text: string(), fileId, csvEncoding: enumeration(['auto', 'utf-8', 'windows-1250', 'latin1']), outputEncoding: enumeration(['utf-8', 'windows-1250']), qifType: enumeration(['Bank', 'CCard', 'Cash']), inputDateFormat: dateFormat, outputDateFormat: dateFormat, appendCode: boolean(false), stopOnError: boolean(false), filename }), oneOf: [{ required: ['text'], not: { required: ['fileId'] } }, { required: ['fileId'], not: { required: ['text'] } }] },
        example: { text: 'Datum knjiženja;Naziv prejemnika;V breme;V dobro;Namen\n10.09.2026;Izmišljena trgovina;12,34;;Test\n' } },
    { name: 'compose_pdf', tool: 'pdf', description: 'Compose a PDF from session-local IDs of already selected PDF files. Pages are one-based; quarterTurns is 0–3 clockwise relative to the original page. Replaces the visible page arrangement, preserving the source documents. Returns a local artifact without saving or sharing. Encrypted PDFs are unsupported; existing signatures are not preserved as valid.',
        inputSchema: schema({ pages: { type: 'array', minItems: 1, maxItems: LIMITS.pages, items: schema({ fileId, page: { type: 'integer', minimum: 1 }, quarterTurns: { type: 'integer', minimum: 0, maximum: 3, default: 0 } }, ['fileId', 'page']) }, filename: { ...filename, default: 'zdruzen-dokument.pdf' } }, ['pages']),
        example: { pages: [{ fileId: 'file-1', page: 2, quarterTurns: 1 }, { fileId: 'file-1', page: 1 }] } },
    { name: 'list_selected_files', description: 'List metadata and session-local file IDs from native CSV/PDF selection. No file contents, local paths, remote fetching or file-picker access.', readOnly: true,
        inputSchema: schema({}), example: {} },
    { name: 'read_artifact', description: 'Read a generated local artifact as base64, at most 65536 raw bytes per call. Offset and length are raw byte counts. Does not expose selected input-file contents.', readOnly: true,
        inputSchema: schema({ id: fileId, offset: { type: 'integer', minimum: 0, default: 0 }, length: { type: 'integer', minimum: 1, maximum: LIMITS.chunkBytes, default: LIMITS.chunkBytes } }, ['id']), example: { id: 'artifact-1', offset: 0, length: 65536 } }
];
export const ERROR_CODES = ['INVALID_ARGUMENT', 'UNKNOWN_OPERATION', 'INVALID_JSON', 'INVALID_JWT', 'INVALID_CSV', 'INVALID_PDF', 'FILE_NOT_FOUND', 'ARTIFACT_NOT_FOUND', 'LIMIT_EXCEEDED', 'CANCELLED', 'PROCESSING_FAILED'];
