import { createAdapter } from '../operations/adapter.mjs';
import { createFileStore, createArtifactStore } from '../operations/session.mjs';
import { API_VERSION, OPERATIONS } from '../operations/catalog.mjs';
import { navigate } from './router.mjs';
import { localizedError } from './shared.mjs';

export const files = createFileStore();
export const artifacts = createArtifactStore();
export function showArtifact(tool, metadata) {
    document.getElementById(tool + '-artifact')?.remove();
    if (!metadata) return;
    const link = document.createElement('a');
    link.id = tool + '-artifact';
    link.className = 'text-link artifact-link';
    link.href = metadata.downloadUrl;
    link.download = metadata.filename;
    link.textContent = 'PRENESI ' + metadata.filename + ' (' + metadata.size + ' B)';
    document.getElementById(tool + '-status').after(link);
}
export const api = createAdapter({ core: window.ToolboxCore, files, artifacts, navigate,
    appVersion: '__DELAVNICA_APP_VERSION__', onInvalidate: tool => showArtifact(tool, null),
    pdf: async (args, check) => {
        if (!await window.DelavnicaPdfLoader.load()) throw new Error('PDF engines could not be loaded.');
        check();
        return window.DelavnicaPdfWorkspace.compose(args, check);
    }
});

export function initOperations() {
    window.DelavnicaSession = { files, artifacts, api, showArtifact, localizedError };
    api.register('pdf', { error(error) {
        const status = document.getElementById('pdf-status');
        status.textContent = localizedError(error); status.classList.add('is-error');
    } });
    window.DelavnicaAgent = Object.freeze({ apiVersion: API_VERSION, appVersion: '__DELAVNICA_APP_VERSION__', execute: (name, input, { signal } = {}) => api.execute(name, input, { signal }) });
    const lifetime = new AbortController();
    window.addEventListener('pagehide', event => { if (!event.persisted) { lifetime.abort(); api.dispose(); window.DelavnicaPdfWorkspace?.dispose(); } });
    const modelContext = document.modelContext;
    if (typeof modelContext?.registerTool !== 'function') return;
    // Independent failures cannot prevent controls or other registrations.
    void Promise.allSettled(OPERATIONS.map(async operation => {
        await modelContext.registerTool({ name: operation.name, description: operation.description,
            inputSchema: operation.inputSchema,
            annotations: { readOnlyHint: !!operation.readOnly, consequentialHint: false, untrustedContentHint: true },
            execute: async (input, { signal } = {}) => JSON.stringify(await api.execute(operation.name, input, { signal }))
        }, { signal: lifetime.signal });
    }));
}
