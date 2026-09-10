import { Zip, ZipPassThrough } from 'fflate';
import { LIMITS } from '../operations/catalog.mjs';
import { failLocal as fail } from '../operations/validation.mjs';

export const IMAGE_LIMITS = Object.freeze({ files: 50, decodedPixels: 40000000, outputPixels: 16000000, side: 8192 });
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
function decodedLimit(width, height) {
    if (!width || !height) fail('INVALID_IMAGE', 'Slika nima veljavnih dimenzij.');
    if (width * height > IMAGE_LIMITS.decodedPixels) fail('LIMIT_EXCEEDED', 'Slika presega 40 milijonov slikovnih pik.');
}

// Read dimensions before native decoding, including all three WebP encodings.
export function imageHeader(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset, value) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
    let width, height, mimeType;
    if (bytes.length >= 24 && bytes[0] === 137 && tag(1, 'PNG\r\n\x1a\n') && tag(12, 'IHDR')) {
        mimeType = 'image/png'; width = view.getUint32(16); height = view.getUint32(20);
    } else if (bytes.length >= 12 && tag(0, 'RIFF') && tag(8, 'WEBP')) {
        mimeType = 'image/webp';
        for (let offset = 12; offset + 8 <= bytes.length;) {
            const size = view.getUint32(offset + 4, true), p = offset + 8;
            if (p + size > bytes.length) break;
            if (tag(offset, 'VP8X') && size >= 10) {
                width = 1 + bytes[p + 4] + (bytes[p + 5] << 8) + (bytes[p + 6] << 16);
                height = 1 + bytes[p + 7] + (bytes[p + 8] << 8) + (bytes[p + 9] << 16); break;
            }
            if (tag(offset, 'VP8 ') && size >= 10 && tag(p + 3, '\x9d\x01\x2a')) {
                width = view.getUint16(p + 6, true) & 16383; height = view.getUint16(p + 8, true) & 16383; break;
            }
            if (tag(offset, 'VP8L') && size >= 5 && bytes[p] === 47) {
                const bits = view.getUint32(p + 1, true);
                width = (bits & 16383) + 1; height = ((bits >>> 14) & 16383) + 1; break;
            }
            offset = p + size + (size % 2);
        }
    } else if (bytes[0] === 255 && bytes[1] === 216) {
        mimeType = 'image/jpeg';
        let offset = 2;
        while (offset + 3 < bytes.length) {
            if (bytes[offset++] !== 255) break;
            while (bytes[offset] === 255) offset++;
            const marker = bytes[offset++];
            if (marker === 217 || marker === 218) break;
            if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
            if (offset + 2 > bytes.length) break;
            const size = view.getUint16(offset);
            if (size < 2 || offset + size > bytes.length) break;
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) {
                height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
            }
            offset += size;
        }
    }
    if (!mimeType || !width || !height) fail('INVALID_IMAGE', 'Datoteka ni veljavna slika JPEG, PNG ali WebP.');
    decodedLimit(width, height);
    return { width, height, mimeType };
}

export function resizeDimensions(width, height, { mode = 'fit', maxWidth = 1920, maxHeight = 1080, enlarge = false, percentage = 100 } = {}) {
    decodedLimit(width, height);
    let scale;
    if (mode === 'fit') {
        if (![maxWidth, maxHeight].every(n => Number.isInteger(n) && n >= 1 && n <= IMAGE_LIMITS.side)) fail('INVALID_ARGUMENT', 'Največja širina in višina morata biti med 1 in 8192.');
        scale = Math.min(maxWidth / width, maxHeight / height, enlarge ? Infinity : 1);
    } else if (mode === 'percentage') {
        if (!Number.isInteger(percentage) || percentage < 1 || percentage > 400) fail('INVALID_ARGUMENT', 'Odstotek mora biti celo število med 1 in 400.');
        scale = percentage / 100;
    } else fail('INVALID_ARGUMENT', 'Izberite prilagoditev meram ali odstotek.');
    const result = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    if (result.width > IMAGE_LIMITS.side || result.height > IMAGE_LIMITS.side || result.width * result.height > IMAGE_LIMITS.outputPixels) fail('LIMIT_EXCEEDED', 'Izhod presega 16 milijonov slikovnih pik ali 8192 pik na stranico. Zmanjšajte mere ali odstotek.');
    return result;
}

export async function decodeImage(file, check = () => {}) {
    check();
    if (file.size > LIMITS.fileBytes) fail('LIMIT_EXCEEDED', 'Datoteka presega omejitev 64 MiB.');
    const header = imageHeader(new Uint8Array(await file.arrayBuffer()));
    check();
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { check(); fail('INVALID_IMAGE', 'Slike ni mogoče odpreti. Datoteka je poškodovana ali nepodprta.'); }
    try { check(); decodedLimit(bitmap.width, bitmap.height); }
    catch (error) { bitmap.close(); throw error; }
    return { bitmap, width: bitmap.width, height: bitmap.height, mimeType: header.mimeType };
}

export function canvasBlob(canvas, mimeType, quality = 0.9) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (!blob) reject(Object.assign(new Error('Kodiranje slike ni uspelo.'), { code: 'INVALID_IMAGE' }));
        else if (blob.type !== mimeType) reject(Object.assign(new Error('Brskalnik ne podpira izbranega izhodnega formata: ' + mimeType + '.'), { code: 'UNSUPPORTED_FORMAT' }));
        else resolve(blob);
    }, mimeType, quality));
}
export async function encoderSupported(mimeType) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    try { await canvasBlob(canvas, mimeType); return true; }
    catch { return false; }
    finally { canvas.width = canvas.height = 0; }
}
export async function imagePreview(file, check = () => {}) {
    const image = await decodeImage(file, check);
    const canvas = document.createElement('canvas');
    try {
        const scale = Math.min(256 / image.width, 256 / image.height, 1);
        canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await canvasBlob(canvas, 'image/png'); check();
        return { blob, width: image.width, height: image.height, mimeType: image.mimeType };
    } finally { image.bitmap.close(); canvas.width = canvas.height = 0; }
}
export function outputFilename(name, mimeType, used) {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
    let stem = name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 120) || 'slika';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
    let result = `${stem}.${extension}`, suffix = 1;
    while (used.has(result.normalize('NFC').toLowerCase())) result = `${stem} (${++suffix}).${extension}`;
    used.add(result.normalize('NFC').toLowerCase());
    return result;
}

export async function resizeImage(file, args, check = () => {}) {
    const image = await decodeImage(file, check);
    const canvas = document.createElement('canvas');
    try {
        const dimensions = resizeDimensions(image.width, image.height, args);
        const mimeType = args.format === 'source' || !args.format ? image.mimeType : args.format;
        if (!IMAGE_TYPES.includes(mimeType) || !await encoderSupported(mimeType)) fail('UNSUPPORTED_FORMAT', 'Brskalnik ne podpira izbranega izhodnega formata: ' + mimeType + '.');
        check();
        canvas.width = dimensions.width; canvas.height = dimensions.height;
        const context = canvas.getContext('2d');
        if (!context) fail('PROCESSING_FAILED', 'Risanje na platno v tem brskalniku ni na voljo.');
        if (mimeType === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await canvasBlob(canvas, mimeType); check();
        if (blob.size > LIMITS.fileBytes) fail('LIMIT_EXCEEDED', 'Izhodna slika presega omejitev 64 MiB.');
        return { blob, ...dimensions, sourceWidth: image.width, sourceHeight: image.height, mimeType };
    } finally { image.bitmap.close(); canvas.width = canvas.height = 0; }
}

// Store already compressed image data without recompression. Feed bounded chunks
// and yield to Clear between them; no workers, remote code or monolithic zipSync.
export async function imageZip(entries, check = () => {}) {
    const chunks = [];
    let size = 0;
    const zip = new Zip((error, data) => {
        if (error) throw error;
        size += data.length;
        if (size > LIMITS.artifactBytes) fail('LIMIT_EXCEEDED', 'ZIP presega omejitev 128 MiB.');
        chunks.push(data);
    });
    try {
        for (const file of entries) {
            check();
            const entry = new ZipPassThrough(file.name); zip.add(entry);
            for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
                const bytes = new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer());
                check(); entry.push(bytes, offset + bytes.length === file.size);
                await yieldTask(); check();
            }
            if (!file.size) entry.push(new Uint8Array(), true);
        }
        zip.end(); check();
        return new File(chunks, 'pomanjsane-slike.zip', { type: 'application/zip' });
    } catch (error) { zip.terminate(); throw error; }
}

export async function resizeImages(args, { files, artifacts, check = () => {}, progress = () => {}, resize = resizeImage, zip = imageZip }) {
    if (!args.fileIds.length || args.fileIds.length > IMAGE_LIMITS.files) fail('LIMIT_EXCEEDED', 'Izberite od 1 do 50 slik.');
    const results = [], successful = [], used = new Set(), warnings = [];
    for (const fileId of args.fileIds) {
        check(); progress({ fileId, state: 'processing' });
        let result;
        try {
            const record = files.get(fileId, 'image-resizer');
            const resized = await resize(record.file, args, check); check();
            const file = new File([resized.blob], outputFilename(record.file.name, resized.mimeType, used), { type: resized.mimeType });
            const { blob, ...dimensions } = resized;
            const artifact = artifacts.add(file, 'image-resizer', dimensions);
            successful.push(file);
            result = { fileId, success: true, ...dimensions, artifact };
        } catch (error) {
            check();
            result = { fileId, success: false, error: { code: error.code || 'INVALID_IMAGE', message: error.message, localized: !!error.localized } };
        }
        results.push(result); progress({ fileId, state: result.success ? 'complete' : 'error', result });
        await yieldTask(); check();
    }
    let zipArtifact = null;
    if (successful.length) {
        try { const file = await zip(successful, check); check(); zipArtifact = artifacts.add(file, 'image-resizer'); }
        catch (error) { check(); warnings.push('ZIP ni bil ustvarjen: ' + error.message + ' Posamezni prenosi so še vedno na voljo.'); }
    }
    return { images: results, count: successful.length, zipArtifact, warnings };
}
