"use strict";

importScripts("./precache-manifest.js");

if (!self.DELAVNICA_PRECACHE
        || !Array.isArray(self.DELAVNICA_PRECACHE.entries)
        || typeof self.DELAVNICA_PRECACHE.version !== "string") {
    throw new Error("The Delavnica precache manifest is invalid.");
}

const CACHE_PREFIX = "delavnica-runtime-";
const CACHE_NAME = CACHE_PREFIX + self.DELAVNICA_PRECACHE.version;
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("./index.html", SCOPE_URL).href;
const PRIVACY_URL = new URL("./zasebnost.html", SCOPE_URL).href;
const PAGE_URLS = new Map();
self.DELAVNICA_PRECACHE.entries.filter(entry => entry.url.endsWith("/index.html")).forEach(entry => {
    const relative = entry.url.replace(/^\.\//, "");
    const href = new URL(entry.url, SCOPE_URL).href;
    PAGE_URLS.set(relative, href);
    PAGE_URLS.set(relative.slice(0, -10), href);
});
const PRECACHE_REQUESTS = self.DELAVNICA_PRECACHE.entries.map(function (entry) {
    return new Request(new URL(entry.url, SCOPE_URL), { cache: "reload" });
});

async function notifyClients(type) {
    let windows;
    try {
        windows = await self.clients.matchAll({
            includeUncontrolled: true,
            type: "window"
        });
    } catch {
        return;
    }
    windows.forEach(function (client) {
        try {
            client.postMessage({
                type,
                version: self.DELAVNICA_PRECACHE.version
            });
        } catch {
            // A disappearing page must not make an otherwise valid install fail.
        }
    });
}

self.addEventListener("install", function (event) {
    event.waitUntil((async function () {
        await caches.delete(CACHE_NAME);
        const cache = await caches.open(CACHE_NAME);
        try {
            await cache.addAll(PRECACHE_REQUESTS);
        } catch (error) {
            await caches.delete(CACHE_NAME);
            throw error;
        }
        await notifyClients("OFFLINE_READY");
    })());
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async function () {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(function (cacheName) {
            if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
            }
            return undefined;
        }));
        await self.clients.claim();
    })());
});

self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

function navigationCacheKey(url) {
    const relativePath = url.pathname.slice(SCOPE_URL.pathname.length).replace(/^\/+/, "");
    if (relativePath === "" || relativePath === "index.html") {
        return INDEX_URL;
    }
    if (relativePath === "zasebnost.html") {
        return PRIVACY_URL;
    }
    return PAGE_URLS.get(relativePath) || null;
}

async function cacheFirst(request, navigationKey) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(navigationKey || request, { ignoreSearch: true });
    return cached || fetch(request);
}

self.addEventListener("fetch", function (event) {
    const request = event.request;
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) {
        return;
    }

    const navigationKey = request.mode === "navigate" ? navigationCacheKey(url) : null;
    event.respondWith(cacheFirst(request, navigationKey));
});
