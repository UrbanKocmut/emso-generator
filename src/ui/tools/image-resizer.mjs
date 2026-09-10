import { api, files } from '../services.mjs';
import { byId, localizedError, setStatus } from '../shared.mjs';
import { IMAGE_LIMITS, imagePreview } from '../../processing/images.mjs';
export function initImageResizer() {
    const tool = 'image-resizer', input = byId(tool + '-file'), list = byId(tool + '-list'), status = byId(tool + '-status'), downloads = byId(tool + '-downloads');
    const controls = Object.fromEntries(['mode', 'maxWidth', 'maxHeight', 'enlarge', 'percentage', 'format'].map(name => [name, byId(tool + '-' + name)]));
    const records = new Map();
    let generation = 0, previews = Promise.resolve();
    function modeControls() {
        const fit = controls.mode.value === 'fit';
        byId(tool + '-fit').hidden = !fit; byId(tool + '-percent').hidden = fit;
        controls.maxWidth.disabled = controls.maxHeight.disabled = controls.enlarge.disabled = !fit;
        controls.percentage.disabled = fit;
    }
    function resetResults() {
        downloads.replaceChildren();
        for (const record of records.values()) {
            record.download.replaceChildren();
            record.state.textContent = record.problem || (record.width ? 'Pripravljeno.' : 'Branje slike…');
        }
    }
    function release(record) {
        if (record.url) URL.revokeObjectURL(record.url);
        record.element.remove(); files.release(record.id); records.delete(record.id);
    }
    function link(artifact) {
        const a = document.createElement('a'); a.className = 'text-link artifact-link';
        a.href = artifact.downloadUrl; a.download = artifact.filename; a.textContent = 'PRENESI ' + artifact.filename;
        return a;
    }
    function renderFile(result) {
        const record = records.get(result.fileId);
        if (!record) return;
        record.download.replaceChildren();
        record.state.textContent = result.success ? `${result.width} × ${result.height} px · Končano.` : localizedError(result.error);
        if (result.success) record.download.append(link(result.artifact));
    }
    function addFiles(selected) {
        api.invalidate(tool);
        const revision = generation, idle = api.whenIdle(tool);
        const problems = [];
        let rejected = 0;
        for (const file of selected) {
            if (records.size >= IMAGE_LIMITS.files) { rejected++; continue; }
            let id;
            try { id = files.add(file, tool); }
            catch (error) {
                problems.push(file.name + ': ' + (error.code === 'LIMIT_EXCEEDED' ? 'Največ 64 MiB na datoteko in 128 MiB izbranih datotek v zavihku.' : localizedError(error)));
                continue;
            }
            if (records.has(id)) continue;
            const element = document.createElement('article'); element.className = 'image-card';
            const img = document.createElement('img'); img.alt = ''; img.hidden = true; img.width = img.height = 128;
            const title = document.createElement('h2'); title.textContent = file.name;
            const dimensions = document.createElement('p'), state = document.createElement('p'), download = document.createElement('div');
            state.textContent = 'Branje slike…'; state.setAttribute('role', 'status');
            const remove = document.createElement('button'); remove.className = 'button'; remove.type = 'button'; remove.textContent = 'ODSTRANI'; remove.setAttribute('aria-label', 'Odstrani ' + file.name);
            const record = { id, element, img, dimensions, state, download };
            remove.addEventListener('click', () => { api.invalidate(tool); release(record); setStatus(status, 'Slika je odstranjena.', false); });
            element.append(img, title, dimensions, state, download, remove); list.append(element); records.set(id, record);
            const check = () => { if (revision !== generation || records.get(id) !== record) throw Object.assign(new Error('Preklicano.'), { code: 'CANCELLED' }); };
            previews = previews.then(async () => {
                await idle;
                try {
                    check(); const preview = await imagePreview(file, check); check();
                    record.url = URL.createObjectURL(preview.blob); record.width = preview.width;
                    img.src = record.url; img.hidden = false;
                    dimensions.textContent = `${preview.width} × ${preview.height} px`;
                    state.textContent = 'Pripravljeno.';
                    files.update(id, { width: preview.width, height: preview.height, sourceMimeType: preview.mimeType });
                } catch (error) {
                    if (error.code !== 'CANCELLED' && records.get(id) === record) { record.problem = localizedError(error); state.textContent = record.problem; }
                }
            });
        }
        if (rejected) problems.push(`Največ 50 slik. Izpuščenih datotek: ${rejected}.`);
        setStatus(status, problems.length ? problems.join(' ') : 'Slike so dodane. Nastavite mere in začnite obdelavo.', !!problems.length);
        input.value = '';
    }
    api.register(tool, {
        invalidate: resetResults,
        async apply(args) {
            for (const [name, control] of Object.entries(controls)) {
                if (name === 'enlarge') control.checked = args[name]; else control.value = String(args[name]);
            }
            modeControls(); await previews;
        },
        progress() { setStatus(status, 'Zaporedna obdelava slik…', false); },
        fileProgress(update) {
            if (update.result) renderFile(update.result);
            else if (records.has(update.fileId)) records.get(update.fileId).state.textContent = 'Obdelava…';
        },
        render(result) {
            for (const image of result.images) renderFile(image);
            downloads.replaceChildren(); if (result.zipArtifact) downloads.append(link(result.zipArtifact));
            setStatus(status, `Uspešno obdelanih slik: ${result.count}/${result.images.length}.` + (result.warnings.length ? ' ' + result.warnings.join(' ') : ''), result.count !== result.images.length || !!result.warnings.length);
        },
        error(error) { resetResults(); setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) { resetResults(); setStatus(status, 'Opravilo je preklicano.', false); } }
    });
    input.addEventListener('change', () => addFiles([...input.files]));
    const drop = byId(tool + '-drop');
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-dragging'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
    drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('is-dragging'); addFiles([...event.dataTransfer.files]); });
    for (const control of Object.values(controls)) control.addEventListener('input', () => { api.invalidate(tool); modeControls(); setStatus(status, 'Nastavitve so spremenjene. Ponovite obdelavo.', false); });
    byId(tool + '-form').addEventListener('submit', event => {
        event.preventDefault();
        const args = { fileIds: [...records.keys()], mode: controls.mode.value, format: controls.format.value, maxWidth: Number(controls.maxWidth.value), maxHeight: Number(controls.maxHeight.value), percentage: Number(controls.percentage.value), enlarge: controls.enlarge.checked };
        void api.execute('resize_images', args, { source: 'manual' });
    });
    function clear() { generation++; api.invalidate(tool); for (const record of records.values()) release(record); input.value = ''; }
    byId(tool + '-clear').addEventListener('click', () => { clear(); setStatus(status, 'Izberite slike za obdelavo.', false); input.focus(); });
    window.addEventListener('pagehide', event => { if (!event.persisted) clear(); });
    modeControls();
}
