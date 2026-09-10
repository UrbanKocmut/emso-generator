import { LIMITS } from './catalog.mjs';
import { fail } from './validation.mjs';

export function createFileStore() {
    const records = new Map();
    let sequence = 0;
    return {
        add(file, tool, extra = {}) {
            const existing = [...records.values()].find(record => record.file === file && record.tool === tool);
            if (existing) return existing.id;
            if (!file || typeof file.arrayBuffer !== 'function') fail('INVALID_ARGUMENT', 'Select a browser file first.');
            if (file.size > LIMITS.fileBytes || [...records.values()].reduce((sum, record) => sum + record.file.size, 0) + file.size > LIMITS.sessionFileBytes) fail('LIMIT_EXCEEDED', 'Selected files exceed the session size limit.');
            const id = 'file-' + ++sequence;
            records.set(id, { id, file, tool, ...extra });
            return id;
        },
        get(id, tool) {
            const record = records.get(id);
            if (!record || (tool && record.tool !== tool)) fail('FILE_NOT_FOUND', 'Selected file is unavailable in this workspace.');
            return record;
        },
        update(id, metadata) { Object.assign(this.get(id), metadata); },
        list() { return [...records.values()].map(({ file, ...metadata }) => ({ ...metadata, name: file.name, mimeType: file.type, size: file.size })); },
        release(id) { records.delete(id); },
        clear(tool) { for (const [id, record] of records) if (!tool || record.tool === tool) records.delete(id); }
    };
}

export function createArtifactStore(urls = URL) {
    const records = new Map();
    let sequence = 0;
    return {
        getFile(id) {
            const record = records.get(id);
            if (!record) fail('ARTIFACT_NOT_FOUND', 'Artifact expired or does not exist.');
            return record.file;
        },
        add(file, tool, counts = {}) {
            const total = [...records.values()].reduce((sum, record) => sum + record.file.size, 0);
            if (total + file.size > LIMITS.artifactBytes) fail('LIMIT_EXCEEDED', 'Generated artifacts exceed the session size limit.');
            const metadata = { id: 'artifact-' + ++sequence, filename: file.name, mimeType: file.type, size: file.size, ...counts, downloadUrl: urls.createObjectURL(file) };
            records.set(metadata.id, { metadata, file, tool });
            return metadata;
        },
        async read({ id, offset, length }) {
            const record = records.get(id);
            if (!record) fail('ARTIFACT_NOT_FOUND', 'Artifact expired or does not exist.');
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > record.file.size || !Number.isInteger(length) || length < 1 || length > LIMITS.chunkBytes) fail('INVALID_ARGUMENT', 'Artifact byte range is out of bounds.');
            const bytes = new Uint8Array(await record.file.slice(offset, offset + length).arrayBuffer());
            if (records.get(id) !== record) fail('ARTIFACT_NOT_FOUND', 'Artifact was invalidated during reading.');
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return { id, offset, bytesRead: bytes.length, nextOffset: offset + bytes.length, eof: offset + bytes.length === record.file.size, base64: btoa(binary) };
        },
        clear(tool) {
            for (const [id, record] of records) if (!tool || record.tool === tool) { urls.revokeObjectURL(record.metadata.downloadUrl); records.delete(id); }
        }
    };
}
