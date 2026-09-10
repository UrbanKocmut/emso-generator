import { promises as fs } from 'node:fs';
import path from 'node:path';
import { collectRuntimeFiles, projectRoot } from './generate-precache.mjs';

// One allowlist shared by deployment staging and offline precaching.
const destination = path.join(projectRoot, '_site');
await fs.mkdir(destination, { recursive: true });
for (const relative of [...await collectRuntimeFiles(), 'service-worker.js', 'precache-manifest.js', 'CNAME', 'logo.png']) {
    const target = path.join(destination, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(projectRoot, relative), target);
}
