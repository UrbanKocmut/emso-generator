"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { Element } = require("./helpers/dom.js");
const source = fs.readFileSync(path.join(__dirname, "../assets/js/pdf-loader.js"), "utf8");

function harness(protocol = "https:") {
    const head = new Element("head");
    const input = new Element("input");
    const status = new Element();
    const dropZone = new Element();
    const window = { location: { protocol } };
    const context = { window, URL, document: {
        baseURI: protocol === "file:" ? "file:///app/index.html" : "https://example.test/sub/index.html",
        head, createElement: (tag) => new Element(tag),
        getElementById: (id) => ({ "pdf-file": input, "pdf-status": status, "pdf-drop-zone": dropZone })[id]
    } };
    vm.runInNewContext(source, context);
    return { head, input, status, dropZone, context, load: window.DelavnicaPdfLoader.load };
}

test("PDF scripts load only on request, once, and relative to the app", async () => {
    const app = harness();
    assert.equal(app.head.children.length, 0);
    const first = app.load();
    assert.equal(app.load(), first);
    assert.equal(app.head.children.length, 1);
    assert.equal(app.head.children[0].src, "https://example.test/sub/assets/js/pdf-merger.js");
    assert.equal(app.input.disabled, true);
    let prevented = false;
    app.dropZone.dispatch("drop", { preventDefault() { prevented = true; } });
    assert.equal(prevented, true, "dropping a PDF during loading must not navigate away");
    app.head.children[0].onload();
    assert.equal(await first, true);
    assert.equal(app.input.disabled, false);
    assert.equal(await app.load(), true);
    assert.equal(app.head.children.length, 1);
});

test("PDF load errors settle without an automatic retry; reopening retries", async () => {
    const app = harness();
    const first = app.load();
    app.head.children[0].onerror();
    assert.equal(await first, false);
    assert.equal(app.head.children.length, 0);
    assert.equal(app.input.disabled, true);
    assert.ok(app.status.classList.contains("is-error"));
    const retry = app.load();
    assert.equal(app.head.children.length, 1);
    app.head.children[0].onload();
    assert.equal(await retry, true);
    assert.equal(app.status.classList.contains("is-error"), false);
});

test("direct file opening loads the classic worker before the PDF bundle", async () => {
    const app = harness("file:");
    const result = app.load();
    assert.equal(app.head.children[0].src, "file:///app/assets/vendor/pdfjs/pdf.worker.classic.js");
    app.context.pdfjsWorker = {};
    app.head.children[0].onload();
    await Promise.resolve();
    assert.equal(app.head.children[1].src, "file:///app/assets/js/pdf-merger.js");
    app.head.children[1].onload();
    assert.equal(await result, true);
});
