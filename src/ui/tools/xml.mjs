import { api } from '../services.mjs';
import { byId, localizedError, setStatus } from '../shared.mjs';
export function initXmlTool() {
    const input = byId('xml-input'), output = byId('xml-output'), indent = byId('xml-indent'), status = byId('xml-status');
    api.register('xml', {
        invalidate() { output.value = ''; },
        apply(args) { input.value = args.text; indent.value = String(args.indent); },
        progress() { setStatus(status, 'Oblikovanje XML…', false); },
        render(result) { output.value = result.text; setStatus(status, 'XML je veljaven in uspešno oblikovan.', false); },
        error(error) { output.value = ''; setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) setStatus(status, 'Opravilo je preklicano.', false); }
    });
    for (const control of [input, indent]) control.addEventListener('input', () => { api.invalidate('xml'); setStatus(status, 'Pritisnite OBLIKUJ za nov izpis.', false); });
    byId('xml-format').addEventListener('click', () => void api.execute('format_xml', { text: input.value, indent: indent.value === 'tab' ? 'tab' : Number(indent.value) }, { source: 'manual' }));
    byId('xml-clear').addEventListener('click', () => { api.invalidate('xml'); input.value = ''; setStatus(status, 'Prilepite XML za oblikovanje.', false); input.focus(); });
}
