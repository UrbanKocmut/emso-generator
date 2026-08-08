(function (root, factory) {
    "use strict";

    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    root.ToolboxCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const DAY_MS = 24 * 60 * 60 * 1000;
    const VAT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2];
    const EMSO_WEIGHTS = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const JWT_ALGORITHMS = Object.freeze({
        HS256: { family: "hmac", name: "HMAC", hash: "SHA-256" },
        HS384: { family: "hmac", name: "HMAC", hash: "SHA-384" },
        HS512: { family: "hmac", name: "HMAC", hash: "SHA-512" },
        RS256: { family: "rsa", name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        RS384: { family: "rsa", name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
        RS512: { family: "rsa", name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
        PS256: { family: "rsa-pss", name: "RSA-PSS", hash: "SHA-256", saltLength: 32 },
        PS384: { family: "rsa-pss", name: "RSA-PSS", hash: "SHA-384", saltLength: 48 },
        PS512: { family: "rsa-pss", name: "RSA-PSS", hash: "SHA-512", saltLength: 64 },
        ES256: { family: "ecdsa", name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" },
        ES384: { family: "ecdsa", name: "ECDSA", hash: "SHA-384", namedCurve: "P-384" },
        ES512: { family: "ecdsa", name: "ECDSA", hash: "SHA-512", namedCurve: "P-521" }
    });

    function randomInt(maxExclusive) {
        if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
            throw new RangeError("maxExclusive must be an integer between 1 and 2^32.");
        }

        const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
        if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
            return Math.floor(Math.random() * maxExclusive);
        }

        const values = new Uint32Array(1);
        const range = 0x100000000;
        const limit = range - (range % maxExclusive);
        let value;

        do {
            cryptoApi.getRandomValues(values);
            value = values[0];
        } while (value >= limit);

        return value % maxExclusive;
    }

    function clampCount(value, maximum) {
        const count = Number.parseInt(value, 10);
        if (!Number.isFinite(count) || count < 1) {
            return 1;
        }
        return Math.min(count, maximum);
    }

    function calculateVatCheckDigit(firstSevenDigits) {
        if (!/^\d{7}$/.test(firstSevenDigits)) {
            throw new TypeError("A seven-digit VAT number body is required.");
        }

        let sum = 0;
        for (let index = 0; index < VAT_WEIGHTS.length; index += 1) {
            sum += Number(firstSevenDigits[index]) * VAT_WEIGHTS[index];
        }

        const candidate = 11 - (sum % 11);
        if (candidate === 10) {
            return null;
        }
        return candidate === 11 ? 0 : candidate;
    }

    function normalizeVatNumber(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "")
            .replace(/^SI/, "");
    }

    function validateSlovenianVat(value) {
        const digits = normalizeVatNumber(value);
        if (!/^[1-9]\d{7}$/.test(digits)) {
            return { valid: false, digits, reason: "Expected eight digits with a non-zero first digit." };
        }

        const expected = calculateVatCheckDigit(digits.slice(0, 7));
        if (expected === null || expected !== Number(digits[7])) {
            return { valid: false, digits, reason: "The modulo 11 checksum does not match." };
        }

        return { valid: true, digits, formatted: "SI" + digits, reason: "Checksum valid." };
    }

    function generateSlovenianVat(rng) {
        const nextInt = rng || randomInt;

        for (let attempt = 0; attempt < 128; attempt += 1) {
            let body = String(nextInt(9) + 1);
            while (body.length < 7) {
                body += String(nextInt(10));
            }

            const checkDigit = calculateVatCheckDigit(body);
            if (checkDigit !== null) {
                return body + String(checkDigit);
            }
        }

        throw new Error("Unable to generate a VAT number with the supplied random source.");
    }

    function generateSlovenianVats(count, options) {
        const settings = options || {};
        const amount = clampCount(count, 5000);
        const prefix = settings.prefix !== false;
        const rng = settings.rng || randomInt;
        const results = new Array(amount);

        for (let index = 0; index < amount; index += 1) {
            const digits = generateSlovenianVat(rng);
            results[index] = prefix ? "SI" + digits : digits;
        }

        return results;
    }

    function calculateEmsoCheckDigit(firstTwelveDigits) {
        if (!/^\d{12}$/.test(firstTwelveDigits)) {
            throw new TypeError("A twelve-digit EMŠO body is required.");
        }

        let sum = 0;
        for (let index = 0; index < EMSO_WEIGHTS.length; index += 1) {
            sum += Number(firstTwelveDigits[index]) * EMSO_WEIGHTS[index];
        }

        const candidate = 11 - (sum % 11);
        if (candidate === 10) {
            return null;
        }
        return candidate === 11 ? 0 : candidate;
    }

    function parseIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            return null;
        }

        return date;
    }

    function toIsoDate(date) {
        return [
            String(date.getUTCFullYear()).padStart(4, "0"),
            String(date.getUTCMonth() + 1).padStart(2, "0"),
            String(date.getUTCDate()).padStart(2, "0")
        ].join("-");
    }

    function subtractYearsUtc(date, years) {
        const result = new Date(date.getTime());
        const originalMonth = result.getUTCMonth();
        result.setUTCFullYear(result.getUTCFullYear() - years);

        if (result.getUTCMonth() !== originalMonth) {
            result.setUTCDate(0);
        }

        return result;
    }

    function randomDateBetween(start, end, rng) {
        const startDay = Math.floor(start.getTime() / DAY_MS);
        const endDay = Math.floor(end.getTime() / DAY_MS);
        if (endDay < startDay) {
            throw new RangeError("The random date range is empty.");
        }
        return new Date((startDay + rng(endDay - startDay + 1)) * DAY_MS);
    }

    function getEmsoDate(options, rng) {
        if (options.date instanceof Date && !Number.isNaN(options.date.getTime())) {
            return new Date(options.date.getTime());
        }

        const now = options.now instanceof Date && !Number.isNaN(options.now.getTime())
            ? new Date(options.now.getTime())
            : new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const end = options.adultOnly ? subtractYearsUtc(today, 18) : today;
        const start = new Date(Date.UTC(1900, 0, 1));
        return randomDateBetween(start, end, rng);
    }

    function generateEmso(options, suppliedRng) {
        const settings = options || {};
        const rng = suppliedRng || randomInt;
        const date = getEmsoDate(settings, rng);
        const gender = settings.gender === "male" || settings.gender === "female"
            ? settings.gender
            : (rng(2) === 0 ? "male" : "female");

        const datePart =
            String(date.getUTCDate()).padStart(2, "0") +
            String(date.getUTCMonth() + 1).padStart(2, "0") +
            String(date.getUTCFullYear() % 1000).padStart(3, "0");

        for (let attempt = 0; attempt < 128; attempt += 1) {
            const register = 50 + rng(10);
            const serial = (gender === "female" ? 500 : 0) + rng(500);
            const body = datePart + String(register) + String(serial).padStart(3, "0");
            const checkDigit = calculateEmsoCheckDigit(body);

            if (checkDigit !== null) {
                return body + String(checkDigit);
            }
        }

        throw new Error("Unable to generate an EMŠO with the supplied random source.");
    }

    function generateEmsos(count, options) {
        const settings = options || {};
        const amount = clampCount(count, 5000);
        const rng = settings.rng || randomInt;
        const results = new Array(amount);

        for (let index = 0; index < amount; index += 1) {
            results[index] = generateEmso(settings, rng);
        }

        return results;
    }

    function validateEmso(value, currentDate) {
        const digits = String(value || "").replace(/\s+/g, "");
        if (!/^\d{13}$/.test(digits)) {
            return { valid: false, digits, reason: "Expected exactly thirteen digits." };
        }

        const checkDigit = calculateEmsoCheckDigit(digits.slice(0, 12));
        if (checkDigit === null || checkDigit !== Number(digits[12])) {
            return { valid: false, digits, reason: "The checksum does not match." };
        }

        const now = currentDate instanceof Date ? currentDate : new Date();
        const day = Number(digits.slice(0, 2));
        const month = Number(digits.slice(2, 4));
        const shortYear = Number(digits.slice(4, 7));
        let year = Math.floor(now.getUTCFullYear() / 1000) * 1000 + shortYear;
        if (year > now.getUTCFullYear()) {
            year -= 1000;
        }

        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
            return { valid: false, digits, reason: "The encoded birth date is invalid." };
        }

        const register = Number(digits.slice(7, 9));
        if (register < 50 || register > 59) {
            return { valid: false, digits, reason: "The Slovenian register code must be between 50 and 59." };
        }

        const serial = Number(digits.slice(9, 12));
        return {
            valid: true,
            digits,
            date: toIsoDate(date),
            register,
            serial,
            gender: serial < 500 ? "male" : "female",
            reason: "Checksum and encoded fields are valid."
        };
    }

    function decodeBase64Url(value) {
        const input = String(value || "");
        if (!/^[A-Za-z0-9_-]*$/.test(input) || input.length % 4 === 1) {
            throw new Error("Invalid base64url encoding.");
        }

        const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
        let binary;

        if (typeof atob === "function") {
            binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return bytes;
        }

        if (typeof Buffer !== "undefined") {
            return new Uint8Array(Buffer.from(base64, "base64"));
        }

        throw new Error("No base64 decoder is available.");
    }

    function decodeUtf8(bytes) {
        if (typeof TextDecoder === "function") {
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        if (typeof Buffer !== "undefined") {
            return Buffer.from(bytes).toString("utf8");
        }
        throw new Error("No UTF-8 decoder is available.");
    }

    function parseJwt(token) {
        const normalized = String(token || "").trim();
        const parts = normalized.split(".");
        if (parts.length !== 3 || !parts[0] || !parts[1]) {
            throw new Error("A JWT must contain three dot-separated segments.");
        }

        let header;
        let payload;
        try {
            header = JSON.parse(decodeUtf8(decodeBase64Url(parts[0])));
        } catch (error) {
            throw new Error("Invalid JWT header: " + error.message);
        }
        try {
            payload = JSON.parse(decodeUtf8(decodeBase64Url(parts[1])));
        } catch (error) {
            throw new Error("Invalid JWT payload: " + error.message);
        }

        if (!header || typeof header !== "object" || Array.isArray(header)) {
            throw new Error("The JWT header must be a JSON object.");
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new Error("The JWT payload must be a JSON object.");
        }
        if (typeof header.alg !== "string" || !header.alg) {
            throw new Error("The JWT header is missing a string alg value.");
        }
        if (header.b64 === false) {
            throw new Error("Unencoded JWS payloads are not valid JWTs.");
        }
        if ("crit" in header && (!Array.isArray(header.crit) || header.crit.some(function (name) { return typeof name !== "string"; }))) {
            throw new Error("The JWT crit header must be an array of strings.");
        }
        if (header.alg === "none" && parts[2]) {
            throw new Error("An unsecured JWT must have an empty signature segment.");
        }
        if (header.alg !== "none" && !parts[2]) {
            throw new Error("A signed JWT must include a signature segment.");
        }

        decodeBase64Url(parts[2]);

        return { token: normalized, parts, header, payload, algorithm: header.alg };
    }

    function analyzeJwtClaims(payload, nowSeconds) {
        const now = Number.isFinite(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000);
        const checks = [];
        let valid = true;

        function checkNumericDate(claim, evaluator, absentMessage) {
            if (!(claim in payload)) {
                checks.push({ claim, state: "absent", message: absentMessage });
                return;
            }
            if (typeof payload[claim] !== "number" || !Number.isFinite(payload[claim])) {
                valid = false;
                checks.push({ claim, state: "invalid", message: "Must be a finite NumericDate value.", value: payload[claim] });
                return;
            }
            const result = evaluator(payload[claim]);
            if (result.state === "invalid") {
                valid = false;
            }
            checks.push({ claim, value: payload[claim], state: result.state, message: result.message });
        }

        checkNumericDate("exp", function (value) {
            return value <= now
                ? { state: "invalid", message: "Expired " + (now - value) + " seconds ago." }
                : { state: "valid", message: "Expires in " + (value - now) + " seconds." };
        }, "No expiration claim.");

        checkNumericDate("nbf", function (value) {
            return value > now
                ? { state: "invalid", message: "Not active for another " + (value - now) + " seconds." }
                : { state: "valid", message: "The token is active." };
        }, "No not-before restriction.");

        checkNumericDate("iat", function (value) {
            return value > now + 60
                ? { state: "warning", message: "Issued in the future; check clock skew." }
                : { state: "valid", message: "Issue time is plausible." };
        }, "No issued-at claim.");

        ["iss", "sub", "aud", "jti"].forEach(function (claim) {
            if (claim in payload) {
                checks.push({ claim, state: "info", value: payload[claim], message: "Present." });
            }
        });

        return { valid, checks, now };
    }

    function getCryptoApi() {
        const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
        if (!cryptoApi || !cryptoApi.subtle) {
            throw new Error("Web Crypto is unavailable in this browser context.");
        }
        return cryptoApi;
    }

    function encodeUtf8(value) {
        if (typeof TextEncoder === "function") {
            return new TextEncoder().encode(value);
        }
        if (typeof Buffer !== "undefined") {
            return new Uint8Array(Buffer.from(value, "utf8"));
        }
        throw new Error("No UTF-8 encoder is available.");
    }

    function decodeBase64Secret(value) {
        const normalized = String(value || "").replace(/\s+/g, "").replace(/=+$/, "");
        return decodeBase64Url(normalized.replace(/\+/g, "-").replace(/\//g, "_"));
    }

    function decodePemPublicKey(value) {
        const match = /^\s*-----BEGIN PUBLIC KEY-----([\s\S]+?)-----END PUBLIC KEY-----\s*$/.exec(String(value || ""));
        if (!match) {
            throw new Error("Expected an SPKI PEM key with BEGIN PUBLIC KEY markers.");
        }
        return decodeBase64Secret(match[1]);
    }

    async function verifyJwtSignature(token, keyValue, options) {
        const parsed = parseJwt(token);
        const definition = JWT_ALGORITHMS[parsed.algorithm];
        if (!definition) {
            if (parsed.algorithm.toLowerCase() === "none") {
                throw new Error("Unsigned JWTs are never treated as signature-valid.");
            }
            throw new Error("Unsupported JWT algorithm: " + parsed.algorithm + ".");
        }
        if (Array.isArray(parsed.header.crit) && parsed.header.crit.length) {
            throw new Error("Critical JOSE header extensions are not supported by this verifier.");
        }

        const cryptoApi = getCryptoApi();
        const settings = options || {};
        const signature = decodeBase64Url(parsed.parts[2]);
        const data = encodeUtf8(parsed.parts[0] + "." + parsed.parts[1]);
        let key;
        let verifyAlgorithm;

        if (definition.family === "hmac") {
            const secret = settings.keyEncoding === "base64"
                ? decodeBase64Secret(keyValue)
                : encodeUtf8(String(keyValue || ""));
            if (!secret.length) {
                throw new Error("A non-empty HMAC secret is required.");
            }
            verifyAlgorithm = { name: definition.name };
            key = await cryptoApi.subtle.importKey(
                "raw",
                secret,
                { name: definition.name, hash: definition.hash },
                false,
                ["verify"]
            );
        } else {
            const publicKey = decodePemPublicKey(keyValue);
            const importAlgorithm = definition.family === "ecdsa"
                ? { name: definition.name, namedCurve: definition.namedCurve }
                : { name: definition.name, hash: definition.hash };
            verifyAlgorithm = definition.family === "ecdsa"
                ? { name: definition.name, hash: definition.hash }
                : (definition.family === "rsa-pss"
                    ? { name: definition.name, saltLength: definition.saltLength }
                    : { name: definition.name });
            key = await cryptoApi.subtle.importKey("spki", publicKey, importAlgorithm, false, ["verify"]);
        }

        const valid = await cryptoApi.subtle.verify(verifyAlgorithm, key, signature, data);
        return { valid, algorithm: parsed.algorithm };
    }

    function parseEuDecimalToCents(raw) {
        if (raw === null || raw === undefined) {
            return null;
        }

        let value = String(raw).trim();
        if (!value) {
            return null;
        }

        value = value
            .replace(/[\u2212\u2013\u2014\uFE63\uFF0D]/g, "-")
            .split("âˆ’").join("-")
            .replace(/[\u00a0 ]/g, "")
            .replace(/[^0-9,.+\-]/g, "");

        if (!value || value === "+" || value === "-") {
            return null;
        }
        if (value.includes(",") && value.includes(".")) {
            value = value.replace(/\./g, "");
        }
        value = value.replace(/,/g, ".");

        const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value);
        if (!match) {
            return null;
        }

        const negative = match[1] === "-";
        const integerDigits = match[2] || "0";
        const fractionDigits = match[3] !== undefined ? match[3] : (match[4] || "");
        const nonZero = /[1-9]/.test(integerDigits + fractionDigits);
        const paddedFraction = (fractionDigits + "000").slice(0, 3);
        let cents = BigInt(integerDigits) * 100n + BigInt(paddedFraction.slice(0, 2));

        if (Number(paddedFraction[2]) >= 5) {
            cents += 1n;
        }
        if (negative) {
            cents = -cents;
        }

        return { cents, nonZero };
    }

    function formatCents(cents) {
        const negative = cents < 0n;
        const magnitude = negative ? -cents : cents;
        const whole = magnitude / 100n;
        const fraction = String(magnitude % 100n).padStart(2, "0");
        return (negative ? "-" : "") + String(whole) + "." + fraction;
    }

    function parseSemicolonCsv(text) {
        const source = String(text || "");
        const rows = [];
        let row = [];
        let field = "";
        let quoted = false;
        let line = 1;
        let rowLine = 1;

        function finishRow() {
            row.push(field);
            rows.push({ cells: row, line: rowLine });
            row = [];
            field = "";
            rowLine = line;
        }

        for (let index = 0; index < source.length; index += 1) {
            const character = source[index];

            if (quoted) {
                if (character === '"') {
                    if (source[index + 1] === '"') {
                        field += '"';
                        index += 1;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += character;
                    if (character === "\n") {
                        line += 1;
                    }
                }
                continue;
            }

            if (character === '"' && field === "") {
                quoted = true;
            } else if (character === ";") {
                row.push(field);
                field = "";
            } else if (character === "\r" || character === "\n") {
                if (character === "\r" && source[index + 1] === "\n") {
                    index += 1;
                }
                line += 1;
                finishRow();
            } else {
                field += character;
            }
        }

        if (quoted) {
            throw new Error("The CSV ends inside a quoted field.");
        }
        if (field || row.length) {
            finishRow();
        }

        return rows;
    }

    function dateFormatPattern(format) {
        const groups = [];
        let pattern = "^";

        for (let index = 0; index < format.length; index += 1) {
            if (format[index] === "%") {
                const token = format[index + 1];
                const definitions = {
                    d: ["day", "(\\d{1,2})"],
                    m: ["month", "(\\d{1,2})"],
                    Y: ["year", "(\\d{4})"],
                    y: ["shortYear", "(\\d{2})"]
                };
                if (!definitions[token]) {
                    throw new Error("Unsupported date token: %" + (token || "") + ".");
                }
                groups.push(definitions[token][0]);
                pattern += definitions[token][1];
                index += 1;
            } else {
                pattern += format[index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }
        }

        return { regex: new RegExp(pattern + "$"), groups };
    }

    function parseFormattedDate(value, format) {
        const definition = dateFormatPattern(format);
        const match = definition.regex.exec(String(value || "").trim());
        if (!match) {
            return null;
        }

        const parts = {};
        definition.groups.forEach(function (name, index) {
            parts[name] = Number(match[index + 1]);
        });
        const year = parts.year !== undefined
            ? parts.year
            : (parts.shortYear >= 69 ? 1900 + parts.shortYear : 2000 + parts.shortYear);
        const month = parts.month;
        const day = parts.day;
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            return null;
        }

        return { year, month, day };
    }

    function formatBankDate(date, format) {
        const replacements = {
            "%d": String(date.day).padStart(2, "0"),
            "%m": String(date.month).padStart(2, "0"),
            "%Y": String(date.year).padStart(4, "0"),
            "%y": String(date.year % 100).padStart(2, "0")
        };
        return format.replace(/%[dmYy]/g, function (token) {
            return replacements[token];
        });
    }

    function safeCsvCell(row, index) {
        return index >= 0 && index < row.length ? row[index].trim() : "";
    }

    function classifyBankTransaction(purpose, amountCents) {
        const value = String(purpose || "").toLowerCase();
        if (amountCents > 0n && (value.includes("obrest") || value.includes("interest"))) {
            return "INTE";
        }
        if (
            amountCents < 0n &&
            ["strošk", "strosk", "storitev", "proviz", "fee"].some(function (word) { return value.includes(word); })
        ) {
            return "COMM";
        }
        if (amountCents > 0n && (value.includes("vrač") || value.includes("vrac") || value.includes("refund"))) {
            return "REFU";
        }
        return "OTHR";
    }

    function convertSparkasseCsv(csvText, options) {
        const settings = options || {};
        const inputDateFormat = settings.inputDateFormat || "%d.%m.%Y";
        const outputDateFormat = settings.outputDateFormat || "%d.%m.%Y";
        const qifType = settings.qifType || "Bank";
        const stopOnError = Boolean(settings.stopOnError);
        const appendCode = Boolean(settings.appendCode);
        const rows = parseSemicolonCsv(csvText);
        const warnings = [];
        const transactions = [];
        let columns = null;

        if (/\r|\n/.test(qifType)) {
            throw new Error("The QIF type cannot contain a line break.");
        }
        dateFormatPattern(inputDateFormat);
        dateFormatPattern(outputDateFormat);

        function report(message) {
            if (stopOnError) {
                throw new Error(message);
            }
            warnings.push(message);
        }

        for (const entry of rows) {
            const cells = entry.cells;
            if (!cells.length || cells.every(function (cell) { return !cell.trim(); })) {
                continue;
            }

            const firstCell = cells[0].replace(/^\uFEFF/, "").trim();
            if (!columns) {
                if (firstCell === "Datum knjiženja") {
                    columns = new Map();
                    cells.forEach(function (cell, index) {
                        columns.set(cell.replace(/^\uFEFF/, "").trim(), index);
                    });
                }
                continue;
            }

            const dateText = safeCsvCell(cells, columns.get("Datum knjiženja") ?? 0);
            if (!dateText) {
                continue;
            }
            const date = parseFormattedDate(dateText, inputDateFormat);
            if (!date) {
                report("Line " + entry.line + ": can't parse date '" + dateText + "' with '" + inputDateFormat + "'.");
                continue;
            }

            const payee = safeCsvCell(cells, columns.get("Naziv prejemnika") ?? -1);
            const debitRaw = safeCsvCell(cells, columns.get("V breme") ?? -1);
            const creditRaw = safeCsvCell(cells, columns.get("V dobro") ?? -1);
            const debit = parseEuDecimalToCents(debitRaw);
            const credit = parseEuDecimalToCents(creditRaw);
            let amountCents = null;

            if (credit && credit.nonZero) {
                amountCents = credit.cents < 0n ? -credit.cents : credit.cents;
            } else if (debit && debit.nonZero) {
                amountCents = debit.cents > 0n ? -debit.cents : debit.cents;
            }

            if (amountCents === null) {
                report("Line " + entry.line + ": no amount (debit='" + debitRaw + "', credit='" + creditRaw + "').");
                continue;
            }

            const purpose = safeCsvCell(cells, columns.get("Namen") ?? -1);
            const references = [
                safeCsvCell(cells, columns.get("Referenca prejemnika") ?? -1),
                safeCsvCell(cells, columns.get("Partnerjeva referenca") ?? -1),
                safeCsvCell(cells, columns.get("Naša referenca") ?? -1)
            ];
            const comment = safeCsvCell(cells, columns.get("Komentar") ?? -1);
            const memoParts = [];

            if (purpose) {
                memoParts.push(purpose);
            }
            references.forEach(function (reference) {
                if (reference && !memoParts.includes(reference)) {
                    memoParts.push(reference);
                }
            });
            if (comment && !memoParts.includes(comment)) {
                memoParts.push(comment);
            }

            let memo = memoParts.join(" | ").trim();
            if (appendCode) {
                memo += ";" + classifyBankTransaction(purpose, amountCents);
            }
            transactions.push({ date, amountCents, payee, memo });
        }

        if (!columns) {
            throw new Error("Sparkasse header 'Datum knjiženja' was not found.");
        }

        const lines = ["!Type:" + qifType];
        transactions.forEach(function (transaction) {
            lines.push("D" + formatBankDate(transaction.date, outputDateFormat));
            lines.push("T" + formatCents(transaction.amountCents));
            lines.push("P" + (transaction.payee.trim() ? transaction.payee : " "));
            if (transaction.memo.trim()) {
                lines.push("M" + transaction.memo);
            }
            lines.push("^");
        });

        return {
            qif: lines.join("\n") + "\n",
            transactionCount: transactions.length,
            warningCount: warnings.length,
            warnings,
            transactions
        };
    }

    function decodeTextBytes(bytes, encoding) {
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const selected = String(encoding || "auto").toLowerCase();

        if (selected === "latin1" || selected === "iso-8859-1") {
            let output = "";
            const chunkSize = 8192;
            for (let offset = 0; offset < data.length; offset += chunkSize) {
                output += String.fromCharCode.apply(null, data.subarray(offset, offset + chunkSize));
            }
            return { text: output, encoding: "latin1" };
        }

        const labels = {
            "utf-8": "utf-8",
            "utf8": "utf-8",
            "utf-8-sig": "utf-8",
            "cp1250": "windows-1250",
            "windows-1250": "windows-1250"
        };

        if (selected !== "auto") {
            const label = labels[selected];
            if (!label) {
                throw new Error("Unsupported text encoding: " + encoding + ".");
            }
            return { text: new TextDecoder(label, { fatal: true }).decode(data), encoding: selected };
        }

        try {
            return { text: new TextDecoder("utf-8", { fatal: true }).decode(data), encoding: "utf-8" };
        } catch (error) {
            return { text: new TextDecoder("windows-1250", { fatal: true }).decode(data), encoding: "windows-1250" };
        }
    }

    function encodeTextBytes(text, encoding) {
        const selected = String(encoding || "utf-8").toLowerCase();
        if (selected === "utf-8" || selected === "utf8") {
            return encodeUtf8(String(text));
        }
        if (selected !== "cp1250" && selected !== "windows-1250") {
            throw new Error("Unsupported QIF encoding: " + encoding + ".");
        }

        const highBytes = new Uint8Array(128);
        for (let index = 0; index < highBytes.length; index += 1) {
            highBytes[index] = index + 128;
        }
        const highCharacters = new TextDecoder("windows-1250").decode(highBytes);
        const characterToByte = new Map();
        Array.from(highCharacters).forEach(function (character, index) {
            if (character !== "�" && !characterToByte.has(character)) {
                characterToByte.set(character, index + 128);
            }
        });

        const bytes = [];
        for (const character of String(text)) {
            const codePoint = character.codePointAt(0);
            if (codePoint <= 0x7f) {
                bytes.push(codePoint);
            } else if (characterToByte.has(character)) {
                bytes.push(characterToByte.get(character));
            } else {
                throw new Error("Character '" + character + "' cannot be encoded as Windows-1250.");
            }
        }
        return new Uint8Array(bytes);
    }

    function sortJsonValue(value) {
        if (Array.isArray(value)) {
            return value.map(sortJsonValue);
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.keys(value)
                    .sort(function (left, right) { return left < right ? -1 : (left > right ? 1 : 0); })
                    .map(function (key) { return [key, sortJsonValue(value[key])]; })
            );
        }
        return value;
    }

    function formatJson(input, options) {
        const settings = options || {};
        const parsed = JSON.parse(String(input));
        const value = settings.sortKeys ? sortJsonValue(parsed) : parsed;
        const indent = settings.minify ? 0 : (settings.indent === "\t" ? "\t" : (settings.indent || 2));
        return JSON.stringify(value, null, indent);
    }

    function formatBytes(bytes) {
        const value = Math.max(0, Number(bytes) || 0);
        if (value < 1024) {
            return Math.round(value) + " B";
        }
        if (value < 1024 * 1024) {
            return (value / 1024).toFixed(value < 10240 ? 1 : 0) + " KB";
        }
        return (value / (1024 * 1024)).toFixed(1) + " MB";
    }

    function utf8Size(value) {
        return encodeUtf8(String(value || "")).byteLength;
    }

    return Object.freeze({
        JWT_ALGORITHMS,
        analyzeJwtClaims,
        calculateEmsoCheckDigit,
        calculateVatCheckDigit,
        clampCount,
        convertSparkasseCsv,
        decodeBase64Url,
        decodeTextBytes,
        encodeTextBytes,
        formatBytes,
        formatJson,
        generateEmso,
        generateEmsos,
        generateSlovenianVat,
        generateSlovenianVats,
        parseIsoDate,
        parseEuDecimalToCents,
        parseSemicolonCsv,
        parseJwt,
        randomInt,
        utf8Size,
        validateEmso,
        validateSlovenianVat,
        verifyJwtSignature
    });
});
