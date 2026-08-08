"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const helperSource = fs.readFileSync(path.join(projectRoot, "assets/js/file-output.js"), "utf8");

function abortError() {
    const error = new Error("The user cancelled the operation.");
    error.name = "AbortError";
    return error;
}

function loadHelper(overrides) {
    const anchors = [];
    const revokedUrls = [];
    const window = Object.assign({
        Blob,
        File,
        navigator: {},
        URL: {
            createObjectURL: function () { return "blob:delavnica-test"; },
            revokeObjectURL: function (url) { revokedUrls.push(url); }
        },
        document: {
            createElement: function (tagName) {
                assert.equal(tagName, "a");
                const anchor = {
                    clicked: false,
                    removed: false,
                    click: function () { this.clicked = true; },
                    remove: function () { this.removed = true; }
                };
                anchors.push(anchor);
                return anchor;
            },
            body: {
                appendChild: function () {}
            }
        },
        setTimeout: function (callback) {
            callback();
            return 1;
        }
    }, overrides || {});

    vm.runInNewContext(helperSource, { window, Promise, Object, Array, Boolean, Error });
    return { api: window.DelavnicaFileOutput, anchors, revokedUrls, window };
}

test("native save picker opens immediately and writes through its handle", async function () {
    const writes = [];
    let pickerCalls = 0;
    let resolvePicker;
    const pickerResult = new Promise(function (resolve) {
        resolvePicker = resolve;
    });
    const handle = {
        createWritable: async function () {
            return {
                write: async function (blob) { writes.push(blob); },
                close: async function () { writes.push("closed"); }
            };
        }
    };
    const { api } = loadHelper({
        showSaveFilePicker: function (options) {
            pickerCalls += 1;
            assert.equal(options.suggestedName, "izvoz.qif");
            return pickerResult;
        }
    });

    const destinationPromise = api.prepareSaveDestination({ suggestedName: "izvoz.qif" });
    assert.equal(pickerCalls, 1, "picker must run before the first asynchronous yield");
    resolvePicker(handle);
    const blob = new Blob(["QIF"], { type: "application/x-qif" });
    const result = await api.writeOrDownload(blob, {
        destination: destinationPromise,
        fileName: "izvoz.qif"
    });

    assert.deepEqual({ ...result }, { cancelled: false, method: "file-system" });
    assert.equal(writes[0], blob);
    assert.equal(writes[1], "closed");
});

test("unsupported native save uses the download fallback", async function () {
    const { api, anchors, revokedUrls } = loadHelper();
    const blob = new Blob(["PDF"], { type: "application/pdf" });
    const result = await api.writeOrDownload(blob, { fileName: "dokument.pdf" });

    assert.deepEqual({ ...result }, { cancelled: false, method: "download" });
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].download, "dokument.pdf");
    assert.equal(anchors[0].href, "blob:delavnica-test");
    assert.equal(anchors[0].clicked, true);
    assert.equal(anchors[0].removed, true);
    assert.deepEqual(revokedUrls, ["blob:delavnica-test"]);
});

test("picker cancellation is silent while native write aborts remain visible", async function () {
    const picker = loadHelper({
        showSaveFilePicker: function () { return Promise.reject(abortError()); }
    });
    assert.deepEqual(
        { ...await picker.api.writeOrDownload(new Blob(["x"]), { fileName: "x.pdf" }) },
        { cancelled: true, method: "file-system" }
    );
    assert.equal(picker.anchors.length, 0);

    const writer = loadHelper({
        showSaveFilePicker: async function () {
            return {
                createWritable: async function () {
                    return {
                        write: async function () { throw abortError(); },
                        abort: async function () {}
                    };
                }
            };
        }
    });
    await assert.rejects(
        writer.api.writeOrDownload(new Blob(["x"]), { fileName: "x.pdf" }),
        /cancelled/
    );
});

test("real picker and write failures remain visible to callers", async function () {
    const pickerFailure = new Error("picker failed");
    const picker = loadHelper({
        showSaveFilePicker: function () { return Promise.reject(pickerFailure); }
    });
    await assert.rejects(
        picker.api.writeOrDownload(new Blob(["x"]), { fileName: "x.pdf" }),
        /picker failed/
    );

    const writeFailure = new Error("disk full");
    const writer = loadHelper({
        showSaveFilePicker: async function () {
            return {
                createWritable: async function () {
                    return {
                        write: async function () { throw writeFailure; },
                        abort: async function () {}
                    };
                }
            };
        }
    });
    await assert.rejects(
        writer.api.writeOrDownload(new Blob(["x"]), { fileName: "x.pdf" }),
        /disk full/
    );
});

test("file sharing checks capability and distinguishes success from cancellation", async function () {
    const shared = [];
    const supported = loadHelper({
        navigator: {
            canShare: function (data) { return data.files.length === 1; },
            share: async function (data) { shared.push(data); }
        }
    });
    const file = new File(["PDF"], "dokument.pdf", { type: "application/pdf" });
    assert.equal(supported.api.canShare(file), true);
    assert.deepEqual({ ...await supported.api.shareFile(file, { title: "Dokument" }) }, { cancelled: false });
    assert.equal(shared[0].files[0], file);
    assert.equal(shared[0].title, "Dokument");

    const cancelled = loadHelper({
        navigator: {
            canShare: function () { return true; },
            share: function () { return Promise.reject(abortError()); }
        }
    });
    assert.deepEqual({ ...await cancelled.api.shareFile(file) }, { cancelled: true });

    const unsupported = loadHelper({ navigator: {} });
    assert.equal(unsupported.api.canShare(file), false);
    await assert.rejects(unsupported.api.shareFile(file), /unavailable/i);
});

test("prepared PDF state invalidates mutations and rejects stale builds", function () {
    const { api } = loadHelper();
    const state = api.createPreparedFileState();
    const first = new File(["one"], "one.pdf", { type: "application/pdf" });
    const staleRevision = state.revision;

    assert.equal(state.set(first, staleRevision), true);
    assert.equal(state.file, first);
    state.invalidate();
    assert.equal(state.file, null);
    assert.equal(state.set(first, staleRevision), false, "an in-flight build cannot restore stale content");

    const second = new File(["two"], "two.pdf", { type: "application/pdf" });
    assert.equal(state.set(second, state.revision), true);
    assert.equal(state.file, second, "a cancelled share can retain the prepared file");
    state.release();
    assert.equal(state.file, null, "a successful share releases the prepared file");
});

test("QIF and PDF controllers wire save/share and all PDF invalidation triggers", function () {
    const uiSource = fs.readFileSync(path.join(projectRoot, "assets/js/toolbox-ui.js"), "utf8");
    const pdfSource = fs.readFileSync(path.join(projectRoot, "assets/js/pdf-merger.mjs"), "utf8");

    assert.match(uiSource, /byId\("qif-share"\)/);
    assert.match(uiSource, /fileOutput\.writeOrDownload\(outputBlob\(\)/);
    assert.match(uiSource, /fileOutput\.shareFile\(file/);
    assert.match(pdfSource, /prepareSaveDestination\([\s\S]*?createPdfFile/);
    assert.match(pdfSource, /shareButton\?\.addEventListener\("click", sharePdf\)/);
    assert.match(pdfSource, /outputName\.addEventListener\("input", invalidatePreparedPdf\)/);
    assert.ok((pdfSource.match(/invalidatePreparedPdf\(\);/g) || []).length >= 6);
    assert.match(pdfSource, /preparedPdf\.release\(\)/);
});
