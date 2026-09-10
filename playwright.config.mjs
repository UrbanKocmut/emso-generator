import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const localBrowsers = path.resolve('node_modules/.cache/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(localBrowsers)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}

export default defineConfig({
    testDir: './tests/browser',
    timeout: 90000,
    workers: 1,
    fullyParallel: true,
    reporter: 'list',
    snapshotPathTemplate: '{testDir}/baselines/{testFilePath}/{arg}{ext}',
    expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 } },
    use: { baseURL: 'http://127.0.0.1:8876', browserName: 'chromium', serviceWorkers: 'block' },
    webServer: { command: `node ${process.env.BASELINE_SITE ? 'node_modules/baseline-site/' : ''}scripts/serve.mjs 8876`, url: 'http://127.0.0.1:8876', reuseExistingServer: false }
});
