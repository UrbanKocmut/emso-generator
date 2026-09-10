import { api } from '../services.mjs';
import { byId, localizedError, setStatus } from '../shared.mjs';
import { HMAC, randomSecret, localDateTime } from '../../processing/jwt-generator.mjs';
export function initJwtGenerator() {
    const fields = Object.fromEntries(['algorithm', 'secret', 'secretEncoding', 'issuer', 'subject', 'audience', 'issuedAt', 'notBefore', 'expiresAt', 'customClaims'].map(name => [name, byId('jwt-generator-' + name)]));
    const output = byId('jwt-generator-output'), header = byId('jwt-generator-header'), payload = byId('jwt-generator-payload'), status = byId('jwt-generator-status');
    function secretHelp() { byId('jwt-generator-secret-help').textContent = `Najmanj ${HMAC[fields.algorithm.value].bytes} dekodiranih bajtov. Besedilo se kodira kot UTF-8.`; }
    function invalidate() { api.invalidate('jwt-generator'); secretHelp(); setStatus(status, 'Pritisnite USTVARI JWT za nov žeton.', false); }
    api.register('jwt-generator', {
        invalidate() { output.value = ''; header.textContent = ''; payload.textContent = ''; },
        apply(args) { for (const [name, field] of Object.entries(fields)) field.value = args[name]; secretHelp(); },
        progress() { setStatus(status, 'Podpisovanje žetona z Web Crypto…', false); },
        render(result) { output.value = result.token; header.textContent = JSON.stringify(result.header, null, 2); payload.textContent = JSON.stringify(result.payload, null, 2); setStatus(status, 'JWT je ustvarjen in podpisan.', false); },
        error(error) { setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) setStatus(status, 'Opravilo je preklicano.', false); }
    });
    for (const field of Object.values(fields)) field.addEventListener('input', invalidate);
    byId('jwt-generator-random').addEventListener('click', () => {
        invalidate();
        try { fields.secret.value = randomSecret(fields.algorithm.value); fields.secretEncoding.value = 'base64'; }
        catch (error) { setStatus(status, localizedError(error), true); }
    });
    byId('jwt-generator-now').addEventListener('click', () => { invalidate(); fields.issuedAt.value = localDateTime(); });
    byId('jwt-generator-hour').addEventListener('click', () => { invalidate(); fields.expiresAt.value = localDateTime(new Date(Date.now() + 3600000)); });
    byId('jwt-generator-form').addEventListener('submit', event => {
        event.preventDefault();
        void api.execute('generate_jwt', Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])), { source: 'manual' });
    });
    byId('jwt-generator-clear').addEventListener('click', () => {
        api.invalidate('jwt-generator');
        byId('jwt-generator-form').reset(); secretHelp();
        setStatus(status, 'Vnesite skrivnost in želene zahtevke.', false); fields.secret.focus();
    });
    secretHelp();
}
