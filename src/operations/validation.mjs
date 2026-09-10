export function fail(code, message) { throw Object.assign(new Error(message), { code }); }

// Implements exactly the schema features used by our small catalog. No coercion.
export function validate(schema, value, location = 'input') {
    if (schema.enum && !schema.enum.includes(value)) fail('INVALID_ARGUMENT', location + ': unsupported value.');
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_ARGUMENT', location + ': expected an object.');
        for (const name of Object.keys(value)) if (!Object.hasOwn(schema.properties, name)) fail('INVALID_ARGUMENT', location + ': unknown property ' + name + '.');
        for (const name of schema.required || []) if (!Object.hasOwn(value, name)) fail('INVALID_ARGUMENT', location + ': missing ' + name + '.');
        const result = {};
        for (const [name, property] of Object.entries(schema.properties)) {
            if (Object.hasOwn(value, name)) result[name] = validate(property, value[name], location + '.' + name);
            else if (Object.hasOwn(property, 'default')) result[name] = property.default;
        }
        return result;
    }
    if (schema.type === 'array') {
        if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems || Infinity)) fail('INVALID_ARGUMENT', location + ': invalid array length.');
        return value.map((item, index) => validate(schema.items, item, location + '[' + index + ']'));
    }
    if (schema.type === 'integer' && (!Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail('INVALID_ARGUMENT', location + ': integer out of range.');
    if (schema.type === 'boolean' && typeof value !== 'boolean') fail('INVALID_ARGUMENT', location + ': expected a boolean.');
    if (schema.type === 'string') {
        if (typeof value !== 'string' || value.length < (schema.minLength || 0) || value.length > (schema.maxLength || Infinity)) fail('INVALID_ARGUMENT', location + ': invalid text length or type.');
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('INVALID_ARGUMENT', location + ': invalid text format.');
    }
    return value;
}

export function validateOperation(definition, input, core) {
    const args = validate(definition.inputSchema, input);
    if (definition.name === 'generate_emso' && args.date) {
        const date = core.parseIsoDate(args.date);
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || !date || date.getUTCFullYear() < 1900 || date > today || args.adultOnly) fail('INVALID_ARGUMENT', 'Use a real date from 1900 through today; date and adultOnly cannot be combined.');
    }
    if (definition.name === 'convert_sparkasse_csv') {
        if (Object.hasOwn(args, 'text') === Object.hasOwn(args, 'fileId')) fail('INVALID_ARGUMENT', 'Supply exactly one of text or fileId.');
        for (const key of ['inputDateFormat', 'outputDateFormat']) {
            const format = args[key];
            if (/[^%]*%[^dmYy]|%$|[\r\n]/.test(format) || !format.includes('%d') || !format.includes('%m') || !/%[Yy]/.test(format)) fail('INVALID_ARGUMENT', 'Date formats need day, month and year using %d, %m, %Y or %y.');
        }
    }
    if (definition.name === 'inspect_jwt' && args.verifySignature && !args.key) fail('INVALID_ARGUMENT', 'A key is required for signature verification.');
    if (args.filename && (/[. ]$/.test(args.filename) || args.filename.trim() !== args.filename)) fail('INVALID_ARGUMENT', 'Filename cannot begin or end with whitespace, or end with a dot.');
    return args;
}
