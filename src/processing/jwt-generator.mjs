import { LIMITS } from '../operations/catalog.mjs';
import { failLocal as fail } from '../operations/validation.mjs';

export const HMAC = Object.freeze({ HS256: { hash: 'SHA-256', bytes: 32 }, HS384: { hash: 'SHA-384', bytes: 48 }, HS512: { hash: 'SHA-512', bytes: 64 } });
const guided = { issuer: 'iss', subject: 'sub', audience: 'aud', issuedAt: 'iat', notBefore: 'nbf', expiresAt: 'exp' };
export function base64(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}
const base64url = bytes => base64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
export function decodeSecret(secret, encoding = 'text') {
    if (typeof secret !== 'string' || secret.length > LIMITS.textCharacters) fail('LIMIT_EXCEEDED', 'Skrivnost presega omejitev besedila.');
    if (encoding === 'text') return new TextEncoder().encode(secret);
    if (encoding !== 'base64') fail('INVALID_ARGUMENT', 'Neveljavno kodiranje skrivnosti.');
    const value = secret.trim();
    if (!/^(?:[A-Za-z0-9+/]*|[A-Za-z0-9_-]*)={0,2}$/.test(value)) fail('INVALID_ARGUMENT', 'Skrivnost ni veljaven Base64/base64url.');
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const raw = normalized.replace(/=+$/, '');
    if (raw.length % 4 === 1 || (value.includes('=') && (value.length % 4 !== 0 || value.length - raw.length !== (4 - raw.length % 4) % 4))) fail('INVALID_ARGUMENT', 'Skrivnost ni veljaven Base64/base64url.');
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    if (base64(bytes).replace(/=+$/, '') !== raw) fail('INVALID_ARGUMENT', 'Skrivnost ni veljaven Base64/base64url.');
    return bytes;
}
export function localDateTime(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function unixSeconds(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) fail('INVALID_ARGUMENT', 'Vnesite veljaven lokalni datum in čas.');
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || localDateTime(date) !== (value.length === 16 ? value + ':00' : value) || date.getFullYear() < 1) fail('INVALID_ARGUMENT', 'Vnesite veljaven lokalni datum in čas.');
    return Math.floor(date.getTime() / 1000);
}
export function randomSecret(algorithm = 'HS256', crypto = globalThis.crypto) {
    if (!HMAC[algorithm]) fail('INVALID_ARGUMENT', 'Izberite HS256, HS384 ali HS512.');
    if (!crypto?.getRandomValues) fail('PROCESSING_FAILED', 'Varni generator naključnih vrednosti ni na voljo.');
    return base64(crypto.getRandomValues(new Uint8Array(HMAC[algorithm].bytes)));
}
export async function generateJwt(args, check = () => {}, crypto = globalThis.crypto) {
    check();
    const algorithm = args.algorithm ?? 'HS256';
    if (!HMAC[algorithm]) fail('INVALID_ARGUMENT', 'Izberite HS256, HS384 ali HS512.');
    if (!crypto?.subtle) fail('PROCESSING_FAILED', 'Web Crypto v tem okolju brskalnika ni na voljo.');
    const secret = decodeSecret(args.secret, args.secretEncoding ?? 'text');
    try {
        if (secret.length < HMAC[algorithm].bytes) fail('INVALID_ARGUMENT', `${algorithm} zahteva skrivnost z najmanj ${HMAC[algorithm].bytes} bajti.`);
        const custom = args.customClaims ?? '{}';
        if (typeof custom !== 'string' || custom.length > LIMITS.textCharacters) fail('LIMIT_EXCEEDED', 'Zahtevki presegajo omejitev besedila.');
        let payload;
        try { payload = JSON.parse(custom); } catch { fail('INVALID_JSON', 'Dodatni zahtevki morajo biti veljaven objekt JSON.'); }
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_ARGUMENT', 'Dodatni zahtevki morajo biti objekt JSON.');
        for (const [field, claim] of Object.entries(guided)) {
            if (Object.hasOwn(payload, claim)) fail('INVALID_ARGUMENT', `Zahtevek ${claim} vnesite v namensko polje, ne v dodatne zahtevke.`);
            const value = args[field];
            if (value !== undefined && value !== '') payload[claim] = ['iat', 'nbf', 'exp'].includes(claim) ? unixSeconds(value) : value;
        }
        const header = { alg: algorithm, typ: 'JWT' };
        const encoder = new TextEncoder();
        const unsigned = [header, payload].map(value => base64url(encoder.encode(JSON.stringify(value)))).join('.');
        if (unsigned.length > LIMITS.textCharacters) fail('LIMIT_EXCEEDED', 'Žeton presega omejitev besedila.');
        const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: HMAC[algorithm].hash }, false, ['sign']);
        check();
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
        check();
        return { token: unsigned + '.' + base64url(new Uint8Array(signature)), header, payload };
    } finally { secret.fill(0); }
}
