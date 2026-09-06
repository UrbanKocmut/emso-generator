import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as pdfCore from "../assets/js/pdf-merger-core.mjs";
import { Element } from "./helpers/dom.js";

// Run the entire controller with fake PDF engines, replacing only static imports.
const source = readFileSync(new URL("../assets/js/pdf-merger.mjs", import.meta.url), "utf8")
    .replace(/^import\s*\{[^}]+\}\s*from\s*"[^"]+";\s*/gm, "");

function harness(getPage, count = 2, observe = false, loadError = null) {
    const nodes = new Map();
    const node = (id) => {
        if (!nodes.has(id)) nodes.set(id, new Element());
        return nodes.get(id);
    };
    let observer;
    let destroyed = 0;
    const window = {
        location: { protocol: "https:" },
        DelavnicaFileOutput: {
            createPreparedFileState: () => ({ invalidate() {} })
        }
    };
    class Observer {
        constructor(callback) { observer = callback; }
        observe() {}
        unobserve() {}
    }
    if (observe) window.IntersectionObserver = Observer;
    vm.runInNewContext(source, {
        ...pdfCore, window, URL, CSS: { escape: (value) => value },
        document: { baseURI: "https://example.test/sub/", readyState: "complete",
            getElementById: node, createElement: (tag) => new Element(tag) },
        GlobalWorkerOptions: {}, PDFDocument: { load: async () => ({}) },
        getDocument: () => ({
            promise: loadError ? Promise.reject(loadError) : Promise.resolve({ numPages: count, getPage }),
            destroy: async () => { destroyed += 1; }
        }),
        IntersectionObserver: Observer
    });
    return {
        node,
        get destroyed() { return destroyed; },
        import() {
            node("pdf-file").files = [{ name: "fixture.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([1]).buffer }];
            node("pdf-file").dispatch("change");
        },
        intersect(card) { observer([{ target: card, isIntersecting: true }]); },
        rotate(card) {
            node("pdf-pages").dispatch("click", { target: card.querySelector('[data-action="rotate-right"]') });
        }
    };
}

async function flush() {
    // Bounded microtask draining also detects retry loops without starving timers.
    for (let i = 0; i < 100; i += 1) await Promise.resolve();
}

function page(render) {
    return { rotate: 0, getViewport: ({ rotation }) => ({ width: 100, height: 150, rotation }),
        render: ({ viewport }) => ({ promise: render(viewport.rotation) }) };
}

test("permanent getPage/render failures stop retrying while later pages render", async () => {
    for (const failDuringRender of [false, true]) {
        const calls = [];
        const app = harness(async (number) => {
            calls.push(number);
            // Bound a regressed loop so the test can fail without hanging the process.
            if (calls.length > 8) return new Promise(() => {});
            if (number === 1 && !failDuringRender) throw new Error("broken page");
            return page(async () => { if (number === 1) throw new Error("broken render"); });
        });
        app.import();
        await flush();
        assert.deepEqual(calls, [1, 2]);
        const cards = app.node("pdf-pages").children;
        assert.equal(cards[0].querySelector("canvas").hidden, true);
        assert.equal(cards[0].querySelector(".pdf-page-loading").textContent, "PREDOGLEDA NI MOGOČE IZRISATI");
        assert.equal(cards[1].querySelector("canvas").hidden, false);
        app.rotate(cards[0]);
        await flush();
        assert.deepEqual(calls, [1, 2, 1], "explicit rotation permits only one new attempt");
    }
});

test("repeated intersection events cannot restart a failed thumbnail", async () => {
    let calls = 0;
    const app = harness(async () => {
        calls += 1;
        if (calls > 8) return new Promise(() => {});
        throw new Error("broken page");
    }, 1, true);
    app.import();
    await flush();
    const card = app.node("pdf-pages").children[0];
    app.intersect(card);
    await flush();
    app.intersect(card);
    await flush();
    assert.equal(calls, 1);
    assert.equal(app.destroyed, 0, "thumbnail failure must not discard the source PDF");
});

test("removing a document's last page releases its PDF loading task", async () => {
    const app = harness(async () => page(async () => {}), 1);
    app.import();
    await flush();
    app.node("pdf-pages").dispatch("click", {
        target: app.node("pdf-pages").querySelector('[data-action="delete"]')
    });
    assert.equal(app.destroyed, 1);
    assert.equal(app.node("pdf-page-count").textContent, "0");
    assert.equal(app.node("pdf-file-count").textContent, "0");
});

test("empty and rejected PDF documents release their loading tasks", async () => {
    for (const error of [null, new Error("Invalid PDF")]) {
        const app = harness(async () => {}, 0, false, error);
        app.import();
        await flush();
        assert.equal(app.destroyed, 1);
        assert.equal(app.node("pdf-file-count").textContent, "0");
        assert.ok(app.node("pdf-status").classList.contains("is-error"));
    }
});

test("rotation during rendering refreshes once with the latest rotation", async () => {
    const rotations = [];
    let finish;
    const app = harness(async () => page((rotation) => {
        rotations.push(rotation);
        return rotations.length === 1 ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve();
    }), 1);
    app.import();
    await flush();
    const card = app.node("pdf-pages").children[0];
    app.rotate(card);
    app.rotate(card);
    finish();
    await flush();
    assert.deepEqual(rotations, [0, 180]);
    assert.equal(card.querySelector("canvas").dataset.rotation, "180");
    assert.equal(card.querySelector("canvas").hidden, false);
});

test("clearing the workspace during a render does not reschedule it", async () => {
    let finish;
    let calls = 0;
    const app = harness(async () => {
        calls += 1;
        return page(() => new Promise((resolve) => { finish = resolve; }));
    }, 1);
    app.import();
    await flush();
    app.node("pdf-clear").dispatch("click");
    finish();
    await flush();
    assert.equal(app.node("pdf-pages").children.length, 0);
    assert.equal(calls, 1);
    assert.equal(app.destroyed, 1);
});
