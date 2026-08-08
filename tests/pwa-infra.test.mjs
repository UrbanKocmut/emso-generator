import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
    canonicalRuntimeContent,
    collectRuntimeFiles,
    createPrecacheData,
    projectRoot
} from "../scripts/generate-precache.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");

async function readJson(relativePath) {
    return JSON.parse(await fs.readFile(path.join(repositoryRoot, relativePath), "utf8"));
}

async function readPrecacheManifest() {
    const source = await fs.readFile(path.join(repositoryRoot, "precache-manifest.js"), "utf8");
    const context = vm.createContext({ self: {} });
    vm.runInContext(source, context, { filename: "precache-manifest.js" });
    return JSON.parse(JSON.stringify(context.self.DELAVNICA_PRECACHE));
}

async function pngDimensions(relativePath) {
    const contents = await fs.readFile(path.join(repositoryRoot, relativePath));
    assert.deepEqual(
        [...contents.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
        relativePath + " must be a PNG"
    );
    return {
        width: contents.readUInt32BE(16),
        height: contents.readUInt32BE(20)
    };
}

function createMemoryCaches(fetchResource, scope) {
    const stores = new Map();

    function requestUrl(request) {
        return new URL(typeof request === "string" ? request : request.url, scope);
    }

    function cacheKey(request, ignoreSearch = false) {
        const url = requestUrl(request);
        if (ignoreSearch) {
            url.search = "";
        }
        url.hash = "";
        return url.href;
    }

    class MemoryCache {
        constructor(entries) {
            this.entries = entries;
        }

        async addAll(requests) {
            const staged = [];
            for (const request of requests) {
                const response = await fetchResource(request);
                if (!response || !response.ok) {
                    throw new TypeError("Precache request failed: " + requestUrl(request).href);
                }
                staged.push([cacheKey(request), response.clone()]);
            }
            staged.forEach(([key, response]) => this.entries.set(key, response));
        }

        async match(request, options = {}) {
            const response = this.entries.get(cacheKey(request, options.ignoreSearch));
            return response && response.clone();
        }

        async put(request, response) {
            this.entries.set(cacheKey(request), response.clone());
        }
    }

    return {
        stores,
        async delete(name) {
            return stores.delete(name);
        },
        async keys() {
            return [...stores.keys()];
        },
        async open(name) {
            if (!stores.has(name)) {
                stores.set(name, new Map());
            }
            return new MemoryCache(stores.get(name));
        }
    };
}

async function createWorkerHarness({ failPattern = null } = {}) {
    const workerSource = await fs.readFile(path.join(repositoryRoot, "service-worker.js"), "utf8");
    const manifestSource = await fs.readFile(path.join(repositoryRoot, "precache-manifest.js"), "utf8");
    const scope = "https://example.test/delavnica/";
    const listeners = new Map();
    const messages = [];
    const networkRequests = [];
    let claimed = 0;
    let offline = false;
    let skipWaitingCalls = 0;

    async function networkFetch(request) {
        const url = new URL(typeof request === "string" ? request : request.url, scope);
        networkRequests.push(url.href);
        if (offline || (failPattern && url.pathname.includes(failPattern))) {
            throw new TypeError("Network unavailable for " + url.href);
        }
        const relativePath = url.pathname.slice(new URL(scope).pathname.length);
        return new Response("network:" + relativePath, {
            headers: { "Content-Type": "application/octet-stream" },
            status: 200
        });
    }

    const caches = createMemoryCaches(networkFetch, scope);
    const worker = {
        registration: { scope },
        location: new URL(scope),
        clients: {
            async claim() {
                claimed += 1;
            },
            async matchAll() {
                return [{ postMessage(message) { messages.push(message); } }];
            }
        },
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        skipWaiting() {
            skipWaitingCalls += 1;
            return Promise.resolve();
        }
    };
    const context = vm.createContext({
        URL,
        Request,
        Response,
        caches,
        console,
        fetch: networkFetch,
        self: worker
    });
    context.importScripts = function (url) {
        assert.equal(url, "./precache-manifest.js");
        vm.runInContext(manifestSource, context, { filename: "precache-manifest.js" });
    };
    vm.runInContext(workerSource, context, { filename: "service-worker.js" });

    async function dispatchLifecycle(type) {
        let completion;
        listeners.get(type)({
            waitUntil(promise) {
                completion = Promise.resolve(promise);
            }
        });
        assert.ok(completion, type + " must call waitUntil");
        await completion;
    }

    async function dispatchFetch(request) {
        let responsePromise;
        listeners.get("fetch")({
            request,
            respondWith(value) {
                responsePromise = Promise.resolve(value);
            }
        });
        return {
            intercepted: Boolean(responsePromise),
            response: responsePromise ? await responsePromise : undefined
        };
    }

    return {
        caches,
        dispatchFetch,
        dispatchLifecycle,
        dispatchMessage(data) {
            listeners.get("message")({ data });
        },
        get claimed() {
            return claimed;
        },
        get messages() {
            return messages;
        },
        get networkRequests() {
            return networkRequests;
        },
        get skipWaitingCalls() {
            return skipWaitingCalls;
        },
        setOffline(value) {
            offline = value;
        },
        scope,
        version: worker.DELAVNICA_PRECACHE.version
    };
}

test("manifest declares the complete standalone Slovenian app surface", async () => {
    const manifest = await readJson("manifest.webmanifest");
    assert.equal(manifest.id, "./");
    assert.equal(manifest.scope, "./");
    assert.equal(manifest.start_url, "./#overview");
    assert.equal(manifest.lang, "sl");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.launch_handler.client_mode, "navigate-existing");
    assert.deepEqual(
        manifest.shortcuts.map((shortcut) => shortcut.url),
        ["./#emso", "./#vat", "./#jwt", "./#json", "./#qif", "./#pdf"]
    );

    for (const icon of manifest.icons) {
        const [width, height] = icon.sizes.split("x").map(Number);
        assert.deepEqual(await pngDimensions(icon.src), { width, height });
    }
    for (const screenshot of manifest.screenshots) {
        const [width, height] = screenshot.sizes.split("x").map(Number);
        assert.deepEqual(await pngDimensions(screenshot.src), { width, height });
    }

    assert.deepEqual(await pngDimensions("logo.png"), { width: 1254, height: 1254 });
    assert.deepEqual(await pngDimensions("assets/icons/favicon.png"), { width: 64, height: 64 });
    assert.deepEqual(await pngDimensions("assets/icons/apple-touch-icon.png"), { width: 180, height: 180 });

    for (const page of ["index.html", "zasebnost.html"]) {
        const html = await fs.readFile(path.join(repositoryRoot, page), "utf8");
        assert.match(html, /href="assets\/icons\/favicon\.png" type="image\/png" sizes="64x64"/);
        assert.match(html, /href="assets\/icons\/apple-touch-icon\.png"/);
        assert.doesNotMatch(html, /favicon\.svg/);
    }
});

test("precache manifest is complete, deterministic, and content-hashed", async () => {
    assert.equal(projectRoot, repositoryRoot);
    const committed = await readPrecacheManifest();
    const generated = await createPrecacheData();
    assert.deepEqual(committed, generated);
    assert.match(committed.version, /^[a-f0-9]{64}$/);
    assert.ok(committed.totalBytes > 7 * 1024 * 1024);

    const expectedUrls = (await collectRuntimeFiles()).map((relativePath) => "./" + relativePath);
    assert.deepEqual(committed.entries.map((entry) => entry.url), expectedUrls);
    for (const entry of committed.entries) {
        const contents = canonicalRuntimeContent(
            entry.url.slice(2),
            await fs.readFile(path.join(repositoryRoot, entry.url.slice(2)))
        );
        assert.equal(entry.size, contents.byteLength, entry.url);
        assert.equal(
            entry.revision,
            createHash("sha256").update(contents).digest("hex"),
            entry.url
        );
    }

    const urls = new Set(expectedUrls);
    assert.ok([...urls].some((url) => url.startsWith("./assets/vendor/pdfjs/cmaps/")));
    assert.ok([...urls].some((url) => url.startsWith("./assets/vendor/pdfjs/iccs/")));
    assert.ok([...urls].some((url) => url.startsWith("./assets/vendor/pdfjs/standard_fonts/")));
    assert.ok([...urls].some((url) => url.startsWith("./assets/vendor/pdfjs/wasm/")));
});

test("build contract pins esbuild and local preview serves web manifests correctly", async () => {
    const packageJson = await readJson("package.json");
    const packageLock = await readJson("package-lock.json");
    assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
    assert.equal(packageLock.packages[""].devDependencies.esbuild, "0.28.1");
    assert.equal(packageLock.packages["node_modules/esbuild"].version, "0.28.1");

    const serverSource = await fs.readFile(path.join(repositoryRoot, "scripts/serve.mjs"), "utf8");
    assert.match(serverSource, /"\.webmanifest", "application\/manifest\+json; charset=utf-8"/);
});

test("service worker installs atomically and serves app entries offline", async () => {
    const harness = await createWorkerHarness();
    const oldCache = await harness.caches.open("delavnica-runtime-old");
    await oldCache.put(harness.scope + "index.html", new Response("old-version"));

    await harness.dispatchLifecycle("install");
    assert.deepEqual(await harness.caches.keys(), [
        "delavnica-runtime-old",
        "delavnica-runtime-" + harness.version
    ]);
    assert.equal(harness.skipWaitingCalls, 0, "updates must wait for explicit user action");
    assert.deepEqual(
        JSON.parse(JSON.stringify(harness.messages)),
        [{ type: "OFFLINE_READY", version: harness.version }]
    );

    harness.setOffline(true);
    const overview = await harness.dispatchFetch({
        method: "GET",
        mode: "navigate",
        url: harness.scope + "?from=installed"
    });
    assert.equal(overview.intercepted, true);
    assert.equal(await overview.response.text(), "network:index.html");

    const privacy = await harness.dispatchFetch({
        method: "GET",
        mode: "navigate",
        url: harness.scope + "zasebnost.html?offline=1"
    });
    assert.equal(await privacy.response.text(), "network:zasebnost.html");

    const pdfAuxiliary = await harness.dispatchFetch({
        method: "GET",
        mode: "same-origin",
        url: harness.scope + "assets/vendor/pdfjs/wasm/openjpeg.wasm"
    });
    assert.equal(await pdfAuxiliary.response.text(), "network:assets/vendor/pdfjs/wasm/openjpeg.wasm");
});

test("failed precache removes only the incomplete new cache", async () => {
    const harness = await createWorkerHarness({ failPattern: "openjpeg.wasm" });
    const oldCacheName = "delavnica-runtime-known-good";
    const oldCache = await harness.caches.open(oldCacheName);
    await oldCache.put(harness.scope + "index.html", new Response("known-good"));

    await assert.rejects(() => harness.dispatchLifecycle("install"), /Network unavailable/);
    assert.deepEqual(await harness.caches.keys(), [oldCacheName]);
    assert.deepEqual(harness.messages, []);
});

test("activation is user-controlled, removes obsolete app caches, and claims pages", async () => {
    const harness = await createWorkerHarness();
    await harness.dispatchLifecycle("install");
    await harness.caches.open("delavnica-runtime-obsolete");
    await harness.caches.open("unrelated-cache");

    harness.dispatchMessage({ type: "IGNORED" });
    assert.equal(harness.skipWaitingCalls, 0);
    harness.dispatchMessage({ type: "SKIP_WAITING" });
    assert.equal(harness.skipWaitingCalls, 1);

    await harness.dispatchLifecycle("activate");
    assert.equal(harness.claimed, 1);
    assert.deepEqual((await harness.caches.keys()).sort(), [
        "delavnica-runtime-" + harness.version,
        "unrelated-cache"
    ].sort());
});

test("external and non-GET requests pass through without interception", async () => {
    const harness = await createWorkerHarness();
    const external = await harness.dispatchFetch({
        method: "GET",
        mode: "cors",
        url: "https://example.org/resource"
    });
    assert.equal(external.intercepted, false);

    const post = await harness.dispatchFetch({
        method: "POST",
        mode: "same-origin",
        url: harness.scope + "index.html"
    });
    assert.equal(post.intercepted, false);
    assert.deepEqual(harness.networkRequests, []);
});
