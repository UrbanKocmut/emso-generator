"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const pwaSource = fs.readFileSync(path.join(projectRoot, "assets/js/pwa.js"), "utf8");

function createSurface() {
    const copies = [
        { dataset: { pwaCopy: "install" }, hidden: true },
        { dataset: { pwaCopy: "update" }, hidden: true }
    ];
    return {
        dataset: {},
        hidden: true,
        copies,
        querySelectorAll(selector) {
            assert.equal(selector, "[data-pwa-copy]");
            return copies;
        }
    };
}

function createButton(surface = null) {
    const listeners = new Map();
    const attributes = new Map();
    return {
        dataset: {},
        disabled: false,
        hidden: true,
        textContent: "NAMESTI",
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        click() {
            listeners.get("click")?.({ target: this });
        },
        closest(selector) {
            assert.equal(selector, "[data-pwa-surface]");
            return surface;
        },
        getAttribute(name) {
            return attributes.get(name) || null;
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        }
    };
}

function createHarness({ waiting = false, installing = false, controlled = false, standalone = false } = {}) {
    const installSurface = createSurface();
    const buttons = [createButton(), createButton(installSurface)];
    buttons[1].dataset.pwaInstallLabel = "NAMESTI";
    buttons[1].dataset.pwaUpdateLabel = "POSODOBI";
    const toast = { dataset: {}, hidden: true, textContent: "" };
    const windowListeners = new Map();
    const workerListeners = new Map();
    const registrationListeners = new Map();
    const workerMessages = [];
    let registerOptions = null;
    let reloadCount = 0;

    const waitingWorker = {
        postMessage(message) {
            workerMessages.push(message);
        }
    };
    const installingWorker = {
        state: "installing",
        addEventListener(type, listener) {
            workerListeners.set("installing:" + type, listener);
        },
        postMessage(message) {
            workerMessages.push(message);
        }
    };
    const registration = {
        installing: installing ? installingWorker : null,
        waiting: waiting ? waitingWorker : null,
        addEventListener(type, listener) {
            registrationListeners.set(type, listener);
        },
        update() {
            return Promise.resolve();
        }
    };
    const serviceWorker = {
        controller: controlled ? {} : null,
        addEventListener(type, listener) {
            workerListeners.set(type, listener);
        },
        async register(url, options) {
            assert.equal(url, "./service-worker.js");
            registerOptions = options;
            return registration;
        }
    };
    const navigator = { serviceWorker, standalone: false };
    const standaloneQuery = {
        matches: standalone,
        addEventListener() {}
    };
    const window = {
        navigator,
        location: {
            reload() {
                reloadCount += 1;
            }
        },
        matchMedia(query) {
            assert.equal(query, "(display-mode: standalone)");
            return standaloneQuery;
        },
        addEventListener(type, listener) {
            windowListeners.set(type, listener);
        },
        clearTimeout() {},
        setTimeout() {
            return 1;
        }
    };
    const document = {
        getElementById(id) {
            return id === "toast" ? toast : null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, "[data-pwa-action]");
            return buttons;
        }
    };

    vm.runInNewContext(pwaSource, {
        Array,
        Boolean,
        Error,
        Number,
        Object,
        Promise,
        String,
        document,
        navigator,
        window
    }, { filename: "pwa.js" });

    return {
        buttons,
        installSurface,
        registration,
        registrationListeners,
        toast,
        installingWorker,
        waitingWorker,
        workerMessages,
        async dispatchWindow(type, event = {}) {
            const listener = windowListeners.get(type);
            assert.ok(listener, "missing window listener for " + type);
            await listener(event);
        },
        dispatchWorker(type, event = {}) {
            const listener = workerListeners.get(type);
            assert.ok(listener, "missing service-worker listener for " + type);
            listener(event);
        },
        transitionInstalling(state) {
            installingWorker.state = state;
            const listener = workerListeners.get("installing:statechange");
            assert.ok(listener, "missing installing-worker statechange listener");
            listener({ target: installingWorker });
        },
        get registerOptions() {
            return registerOptions;
        },
        get reloadCount() {
            return reloadCount;
        }
    };
}

test("install actions only appear for a browser-provided install prompt", async function () {
    const harness = createHarness();
    let prevented = 0;
    let prompted = 0;
    await harness.dispatchWindow("beforeinstallprompt", {
        preventDefault() {
            prevented += 1;
        },
        prompt() {
            prompted += 1;
            return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "dismissed" })
    });

    assert.equal(prevented, 1);
    assert.equal(harness.buttons[0].textContent, "NAMESTI");
    assert.equal(harness.buttons[1].textContent, "NAMESTI");
    harness.buttons.forEach(function (button) {
        assert.equal(button.hidden, false);
        assert.equal(button.dataset.pwaMode, "install");
    });
    assert.equal(harness.installSurface.hidden, false);
    assert.equal(harness.installSurface.dataset.pwaMode, "install");
    assert.equal(harness.installSurface.copies[0].hidden, false);
    assert.equal(harness.installSurface.copies[1].hidden, true);

    harness.buttons[0].click();
    assert.equal(prompted, 1);
    harness.buttons.forEach(function (button) {
        assert.equal(button.hidden, true, "dismissed prompts must not leave a dead install action");
    });
    assert.equal(harness.installSurface.hidden, true);
});

test("waiting updates are explicit, bypass HTTP cache, and reload once after activation", async function () {
    const harness = createHarness({ waiting: true, controlled: true });
    await harness.dispatchWindow("load");

    assert.deepEqual({ ...harness.registerOptions }, {
        scope: "./",
        updateViaCache: "none"
    });
    assert.equal(harness.buttons[0].textContent, "POSODOBI");
    assert.equal(harness.buttons[1].textContent, "POSODOBI");
    harness.buttons.forEach(function (button) {
        assert.equal(button.hidden, false);
        assert.equal(button.dataset.pwaMode, "update");
    });
    assert.equal(harness.installSurface.dataset.pwaMode, "update");
    assert.equal(harness.installSurface.copies[0].hidden, true);
    assert.equal(harness.installSurface.copies[1].hidden, false);

    harness.buttons[0].click();
    assert.deepEqual(
        JSON.parse(JSON.stringify(harness.workerMessages)),
        [{ type: "SKIP_WAITING" }]
    );
    assert.equal(harness.buttons[0].disabled, true);

    harness.dispatchWorker("controllerchange");
    harness.dispatchWorker("controllerchange");
    assert.equal(harness.reloadCount, 1);
});

test("an update already installing when registration resolves becomes actionable", async function () {
    const harness = createHarness({ installing: true, controlled: true });
    await harness.dispatchWindow("load");

    harness.buttons.forEach(function (button) {
        assert.equal(button.hidden, true);
    });

    harness.transitionInstalling("installed");
    assert.equal(harness.buttons[0].textContent, "POSODOBI");
    assert.equal(harness.buttons[1].textContent, "POSODOBI");
    harness.buttons.forEach(function (button) {
        assert.equal(button.hidden, false);
    });

    harness.buttons[1].click();
    assert.deepEqual(
        JSON.parse(JSON.stringify(harness.workerMessages)),
        [{ type: "SKIP_WAITING" }]
    );
});

test("offline-ready messages use the shared revision-safe toast", function () {
    const harness = createHarness();
    harness.dispatchWorker("message", { data: { type: "OFFLINE_READY" } });
    assert.equal(harness.toast.hidden, false);
    assert.match(harness.toast.textContent, /BREZ POVEZAVE/);
    assert.equal(harness.toast.dataset.toastRevision, "1");
    assert.match(pwaSource, /toast\.dataset\.toastRevision === revision/);
});
