"use strict";

const runButton = document.getElementById("run");
const results = document.getElementById("results");
const summary = document.getElementById("summary");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let touchId = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function openPage(route = "overview", width = 390, height = 844) {
    const frame = document.createElement("iframe");
    frame.title = "Delavnica mobile preview";
    frame.style.width = width + "px";
    frame.style.height = height + "px";
    const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    frame.src = "../index.html#" + route;
    document.getElementById("preview").replaceChildren(frame);
    await loaded;
    const win = frame.contentWindow;
    await win.document.fonts.ready;
    return { frame, win, doc: win.document };
}

function touch(page, target, type, x, y = 280, identifier = touchId) {
    const point = new page.win.Touch({ identifier, target, clientX: x, clientY: y });
    const ended = type === "touchend" || type === "touchcancel";
    target.dispatchEvent(new page.win.TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: ended ? [] : [point],
        targetTouches: ended ? [] : [point],
        changedTouches: [point]
    }));
}

function beginSwipe(page, start = 300, end = 100, target = page.doc.elementFromPoint(start, 280)) {
    touchId += 1;
    touch(page, target, "touchstart", start);
    touch(page, target, "touchmove", end);
    return () => touch(page, target, "touchend", end);
}

function swipe(page, start = 300, end = 100) {
    beginSwipe(page, start, end)();
}

function assertRoute(page, route) {
    const path = route === "overview" ? "/" : "/" + page.win.ToolboxTools.find(tool => tool.id === route).path;
    assert(page.win.location.pathname === path, "Expected route " + route + ", got " + page.win.location.pathname);
    const visible = [...page.doc.querySelectorAll("[data-panel]")].filter((panel) => !panel.hidden);
    assert(visible.length === 1 && visible[0].dataset.panel === route,
        "Expected only " + route + " visible, got " + visible.map((panel) => panel.dataset.panel));
    assert(!page.doc.querySelector(".is-swiping, .is-swipe-settling, .is-swipe-active, .is-swipe-target"),
        "Swipe state remained after navigation");
    for (const panel of page.doc.querySelectorAll("[data-panel]")) {
        assert(!panel.style.transform && !panel.style.top && !panel.hasAttribute("aria-hidden"),
            "Stale panel presentation on " + panel.dataset.panel);
    }
    assert(page.doc.querySelector('[data-route="' + route + '"]').getAttribute("aria-current") === "page",
        "Navigation selection does not match the tool");
}

const checks = [
    ["Direct PDF navigation loads the real engines and renders an imported local PDF", async () => {
        const page = await openPage("pdf");
        const input = page.doc.getElementById("pdf-file");
        const deadline = Date.now() + 10000;
        while (input.disabled && Date.now() < deadline) await delay(50);
        assert(!input.disabled, "PDF tool did not finish loading");
        const { PDFDocument } = await import("../assets/vendor/pdf-lib/pdf-lib.esm.min.js");
        const fixture = await PDFDocument.create();
        fixture.addPage([200, 300]);
        fixture.addPage([300, 200]);
        const transfer = new page.win.DataTransfer();
        transfer.items.add(new page.win.File([await fixture.save()], "browser-fixture.pdf", { type: "application/pdf" }));
        input.files = transfer.files;
        input.dispatchEvent(new page.win.Event("change", { bubbles: true }));
        const renderDeadline = Date.now() + 10000;
        while (page.doc.getElementById("pdf-page-count").textContent !== "2" && Date.now() < renderDeadline) await delay(50);
        // Thumbnails are intentionally lazy: bring the iframe and cards into view.
        page.frame.scrollIntoView();
        page.doc.getElementById("pdf-pages").scrollIntoView();
        while (page.doc.querySelectorAll('#pdf-pages canvas:not([hidden])').length < 2 && Date.now() < renderDeadline) await delay(50);
        assert(page.doc.getElementById("pdf-page-count").textContent === "2", "Local PDF import lost pages");
        assert(page.doc.querySelectorAll('#pdf-pages canvas:not([hidden])').length === 2, "Real PDF thumbnails did not render");
        const card = page.doc.querySelector(".pdf-page-card");
        card.querySelector('[data-action="rotate-right"]').click();
        const rotateDeadline = Date.now() + 10000;
        while (card.querySelector("canvas").dataset.rotation !== "90" && Date.now() < rotateDeadline) await delay(50);
        assert(card.querySelector("canvas").dataset.rotation === "90", "Rotation did not refresh the thumbnail");
        assert(!page.doc.getElementById("pdf-download").disabled, "PDF export was not enabled");
        // Capture the save boundary inside this test iframe; no OS dialog or disk write.
        let saved;
        page.win.showSaveFilePicker = async () => ({
            createWritable: async () => ({
                write: async (file) => { saved = file; },
                close: async () => {}
            })
        });
        page.doc.getElementById("pdf-download").click();
        const exportDeadline = Date.now() + 10000;
        while ((!saved || page.doc.getElementById("pdf-download").disabled) && Date.now() < exportDeadline) await delay(50);
        assert(saved, "PDF export did not produce a file");
        const exported = await PDFDocument.load(new Uint8Array(await saved.arrayBuffer()));
        assert(exported.getPageCount() === 2, "PDF export lost pages");
        assert(exported.getPage(0).getRotation().angle === 90, "PDF export lost the rotation");
        assert(exported.getPage(1).getWidth() === 300, "PDF export changed the source page size");
        page.doc.getElementById("pdf-clear").click();
        assert(page.doc.getElementById("pdf-page-count").textContent === "0", "Clear did not remove pages");
    }],
    ["Tool registry renders matching navigation, cards, titles, and routes", async () => {
        const page = await openPage();
        const ids = page.win.ToolboxTools.map(tool => tool.id);
        const links = [...page.doc.querySelectorAll('.tool-nav [data-route]')];
        assert(links.map((link) => link.dataset.route).join() === ["overview", ...ids].join(), "Navigation order changed");
        assert(page.doc.getElementById("tool-count").textContent === String(page.win.ToolboxTools.length).padStart(2, "0"), "Tool count is incorrect");
        const cards = [...page.doc.querySelectorAll(".overview-grid .tool-card")];
        assert(cards.map((card) => card.dataset.route).join() === ids.join(), "Overview cards do not match navigation");
        assert(!page.doc.querySelector('script[src$="pdf-merger.js"]'), "PDF was executed before opening the tool");
        assert(!page.doc.querySelector('script[src$="pdf.worker.classic.js"]'), "Classic PDF worker was loaded on HTTP");
        for (const id of ids) {
            page.doc.querySelector('[data-route="' + id + '"]').click();
            await delay(40);
            assertRoute(page, id);
            assert(page.doc.title === page.win.ToolboxTools.find((tool) => tool.id === id).pageTitle, "Page title does not match the registry");
        }
        assert(page.doc.querySelectorAll('script[src$="pdf-merger.js"]').length === 1, "PDF bundle should load exactly once");
    }],
    ["The open rail and close button fit the logo column while the toolbar stays above scrolling content", async () => {
        for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
            const page = await openPage("overview", width, height);
            const hint = page.doc.getElementById("mobile-info-hint");
            const rail = page.doc.getElementById("mobile-info-rail");
            const sidebar = page.doc.querySelector(".sidebar");
            hint.click();
            await delay(320);
            const navTop = sidebar.getBoundingClientRect().top;
            const railTop = rail.getBoundingClientRect().top;
            for (const scrollY of [0, 500, page.doc.documentElement.scrollHeight]) {
                page.win.scrollTo({ top: scrollY, behavior: "instant" });
                const nav = sidebar.getBoundingClientRect();
                const panel = rail.getBoundingClientRect();
                const logo = page.doc.querySelector(".mobile-home-link").getBoundingClientRect();
                const close = page.doc.getElementById("mobile-info-close").getBoundingClientRect();
                assert(Math.abs(nav.top - navTop) < 1, "Toolbar moved while scrolling at width " + width);
                assert(Math.abs(panel.top - railTop) < 1, "Info rail moved while scrolling");
                assert(Math.abs(panel.top - nav.bottom) < 1, "The rail overlaps the toolbar or leaves a gap");
                assert(Math.abs(panel.right - logo.right) < 1, "The rail extends beyond the logo");
                assert(close.left >= panel.left && close.right <= panel.right,
                    "The close button protrudes from the rail at width " + width);
                assert(sidebar.contains(page.doc.elementFromPoint(nav.width / 2, nav.top + nav.height / 2)),
                    "Scrolling content obstructs the toolbar");
            }
        }
    }],
    ["Pulling the info rail fully open never stretches it past the logo edge", async () => {
        const page = await openPage();
        const overview = page.doc.querySelector('[data-panel="overview"]');
        const release = beginSwipe(page, 20, 300, overview);
        const logo = page.doc.querySelector(".mobile-home-link").getBoundingClientRect();
        const rail = page.doc.getElementById("mobile-info-rail").getBoundingClientRect();
        assert(Math.abs(rail.right - logo.right) < 1, "The rail overextends during a long drag");
        release();
        await delay(320);
        assert(page.doc.getElementById("mobile-info-hint").getAttribute("aria-expanded") === "true", "The rail did not stay open");
    }],
    ["Landing tab keeps its height during opening and closing, including after vertical scroll", async () => {
        const page = await openPage();
        const hint = page.doc.getElementById("mobile-info-hint");
        const overview = page.doc.querySelector('[data-panel="overview"]');
        for (const scrollY of [0, 160]) {
            page.win.scrollTo({ top: scrollY, behavior: "instant" });
            const top = hint.getBoundingClientRect().top;
            const release = beginSwipe(page, 100, 145, overview);
            assert(Math.abs(hint.getBoundingClientRect().top - top) < 1, "Tab jumped vertically while opening at scroll " + scrollY);
            release();
            await delay(320);
            assert(hint.getAttribute("aria-expanded") === "true", "Rail did not open");
            page.doc.getElementById("mobile-info-close").click();
            await delay(320);
            assert(Math.abs(hint.getBoundingClientRect().top - top) < 1, "Tab moved after closing");
        }
    }],
    ["A second swipe during a tool transition continues to the following tool", async () => {
        const page = await openPage("emso");
        swipe(page);
        await delay(60);
        swipe(page);
        await delay(400);
        assertRoute(page, "jwt");
    }],
    ["The landing page hands off rapid swipes without opening its info rail", async () => {
        const page = await openPage();
        swipe(page);
        await delay(60);
        swipe(page, 100, 300);
        await delay(400);
        assertRoute(page, "overview");
        assert(!page.doc.body.classList.contains("is-mobile-info-open"), "A tool swipe opened the info rail");
    }],
    ["Queued route events preserve the next swipe preview while a finger is down", async () => {
        const page = await openPage("emso");
        swipe(page, 100, 300);
        const release = beginSwipe(page);
        await delay(60);
        const preview = page.doc.querySelector(".is-swipe-target");
        assert(preview && !preview.hidden && preview.style.transform, "Queued navigation reset the preview");
        release();
        await delay(400);
        assertRoute(page, "emso");
    }],
    ["A touch during settling preserves the destination even without another swipe", async () => {
        const page = await openPage("emso");
        swipe(page);
        await delay(60);
        const surface = page.doc.getElementById("main-content");
        touchId += 1;
        touch(page, surface, "touchstart", 180);
        touch(page, surface, "touchend", 180);
        await delay(400);
        assertRoute(page, "vat");
    }],
    ["Immediate repeated swipes cannot leave stale animation frames behind", async () => {
        const page = await openPage("emso");
        swipe(page);
        swipe(page);
        swipe(page);
        await delay(400);
        assertRoute(page, "json");
    }],
    ["Reversing during settling returns one tool and leaves a clean page", async () => {
        const page = await openPage("emso");
        swipe(page);
        await delay(60);
        swipe(page, 100, 300);
        await delay(400);
        assertRoute(page, "emso");
    }],
    ["Selecting a navigation link during a swipe wins over the pending animation", async () => {
        const page = await openPage("emso");
        swipe(page);
        await delay(60);
        page.doc.querySelector('[data-route="pdf"]').click();
        await delay(400);
        assertRoute(page, "pdf");
    }],
    ["A cancelled swipe restores a single panel and the next swipe still works", async () => {
        const page = await openPage("emso");
        beginSwipe(page);
        touch(page, page.doc.getElementById("main-content"), "touchcancel", 100);
        await delay(400);
        assertRoute(page, "emso");
        swipe(page);
        await delay(400);
        assertRoute(page, "vat");
    }],
    ["Landscape mobile and tablet layouts support consecutive swipes", async () => {
        for (const [width, height] of [[844, 390], [768, 1024]]) {
            const page = await openPage("json", width, height);
            swipe(page);
            await delay(60);
            swipe(page);
            await delay(400);
            assertRoute(page, "pdf");
        }
    }],
    ["A swipe after vertical scrolling resets the destination to the page top", async () => {
        const page = await openPage("emso");
        page.win.scrollTo({ top: 450, behavior: "instant" });
        swipe(page);
        await delay(400);
        assertRoute(page, "vat");
        assert(page.win.scrollY === 0, "The destination retained the previous tool's scroll position");
    }],
    ["The moved landing tab still opens by touch and stays hidden on tool routes", async () => {
        const page = await openPage();
        const hint = page.doc.getElementById("mobile-info-hint");
        beginSwipe(page, 4, 70, hint)();
        await delay(320);
        assert(hint.getAttribute("aria-expanded") === "true", "Dragging the tab did not open the rail");
        page.doc.querySelector('[data-route="emso"]').click();
        await delay(320);
        assertRoute(page, "emso");
        assert(hint.hidden, "The landing tab is visible on a tool route");
        assert(page.doc.getElementById("mobile-info-rail").inert, "The info rail remained interactive");
    }]
];

runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    results.replaceChildren();
    let passed = 0;
    for (const [name, check] of checks) {
        summary.textContent = "Running: " + name;
        const item = document.createElement("li");
        results.append(item);
        try {
            await check();
            item.dataset.result = "pass";
            item.textContent = "PASS — " + name;
            passed += 1;
        } catch (error) {
            item.dataset.result = "fail";
            item.textContent = "FAIL — " + name + ": " + error.message;
        }
    }
    summary.textContent = passed + "/" + checks.length + " checks passed";
    runButton.disabled = false;
});
