import {
    getDocument,
    GlobalWorkerOptions
} from "../vendor/pdfjs/pdf.min.mjs";
import {
    PDFDocument,
    degrees
} from "../vendor/pdf-lib/pdf-lib.esm.min.js";
import {
    movePage,
    normalizeRotation,
    reorderPage
} from "./pdf-merger-core.mjs";

const PDF_MERGER_SCRIPT_URL = new URL("assets/js/pdf-merger.js", document.baseURI);
if (window.location.protocol !== "file:") {
    delete globalThis.pdfjsWorker;
}
GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", PDF_MERGER_SCRIPT_URL).href;

const PDFJS_ASSET_ROOT = new URL("../vendor/pdfjs/", PDF_MERGER_SCRIPT_URL);
const PDFJS_OPTIONS = Object.freeze({
    cMapUrl: new URL("cmaps/", PDFJS_ASSET_ROOT).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", PDFJS_ASSET_ROOT).href,
    wasmUrl: new URL("wasm/", PDFJS_ASSET_ROOT).href,
    iccUrl: new URL("iccs/", PDFJS_ASSET_ROOT).href,
    isEvalSupported: false,
    stopAtErrors: false
});

function initPdfMerger() {
    const fileInput = document.getElementById("pdf-file");
    if (!fileInput) {
        return;
    }
    const fileOutput = window.DelavnicaFileOutput;
    if (!fileOutput) {
        throw new Error("DelavnicaFileOutput failed to load.");
    }

    const dropZone = document.getElementById("pdf-drop-zone");
    const fileHint = document.getElementById("pdf-file-hint");
    const clearButton = document.getElementById("pdf-clear");
    const status = document.getElementById("pdf-status");
    const pageCount = document.getElementById("pdf-page-count");
    const fileCount = document.getElementById("pdf-file-count");
    const emptyState = document.getElementById("pdf-empty-state");
    const pagesList = document.getElementById("pdf-pages");
    const outputName = document.getElementById("pdf-output-name");
    const downloadButton = document.getElementById("pdf-download");
    const shareButton = document.getElementById("pdf-share");

    const documents = new Map();
    let pages = [];
    let documentSequence = 0;
    let pageSequence = 0;
    let busy = false;
    let draggedPageId = "";
    let renderQueue = Promise.resolve();
    const queuedThumbnails = new Set();
    const pdfFileType = "application/pdf";
    const pdfPickerTypes = [{
        description: "Dokument PDF",
        accept: { "application/pdf": [".pdf"] }
    }];
    const pdfSharingAvailable = Boolean(
        shareButton &&
        typeof window.File === "function" &&
        fileOutput.canShare(new File([""], "delavnica.pdf", { type: pdfFileType }))
    );
    const preparedPdf = fileOutput.createPreparedFileState();

    const thumbnailObserver = "IntersectionObserver" in window
        ? new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    thumbnailObserver.unobserve(entry.target);
                    scheduleThumbnail(entry.target.dataset.pageId);
                }
            });
        }, { rootMargin: "320px 0px" })
        : null;

    function setStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle("is-error", Boolean(isError));
    }

    function captureStatus() {
        return {
            message: status.textContent,
            isError: status.classList.contains("is-error")
        };
    }

    function restoreStatus(snapshot) {
        setStatus(snapshot.message, snapshot.isError);
    }

    function syncShareAction() {
        if (!shareButton) {
            return;
        }
        shareButton.hidden = !pdfSharingAvailable;
        shareButton.disabled = busy || pages.length === 0;
        shareButton.textContent = preparedPdf.file ? "DELI PDF" : "PRIPRAVI ZA DELJENJE";
    }

    function invalidatePreparedPdf() {
        preparedPdf.invalidate();
        syncShareAction();
    }

    function setBusy(nextBusy) {
        busy = nextBusy;
        fileInput.disabled = busy;
        clearButton.disabled = busy || pages.length === 0;
        downloadButton.disabled = busy || pages.length === 0;
        outputName.disabled = busy;
        syncShareAction();
        pagesList.classList.toggle("is-busy", busy);
    }

    function plural(value, singular, dual, pluralForm) {
        if (value === 1) {
            return singular;
        }
        if (value === 2) {
            return dual;
        }
        return pluralForm;
    }

    function pageById(pageId) {
        return pages.find(function (page) {
            return page.id === pageId;
        });
    }

    function documentIsStillUsed(documentId) {
        return pages.some(function (page) {
            return page.documentId === documentId;
        });
    }

    function releaseUnusedDocument(documentId) {
        if (documentIsStillUsed(documentId)) {
            return;
        }
        const record = documents.get(documentId);
        documents.delete(documentId);
        if (record) {
            Promise.resolve(record.viewer.destroy()).catch(function () {
                // The page data is already discarded from the workspace.
            });
        }
    }

    function updateCard(card, item, index) {
        const position = card.querySelector(".pdf-page-position");
        const source = card.querySelector(".pdf-page-source");
        const rotation = card.querySelector(".pdf-page-rotation");
        const previousButton = card.querySelector('[data-action="previous"]');
        const nextButton = card.querySelector('[data-action="next"]');

        position.textContent = String(index + 1).padStart(2, "0");
        source.textContent = item.fileName + " / STRAN " + item.sourcePage;
        rotation.textContent = item.rotation ? item.rotation + "°" : "IZVIRNA SMER";
        previousButton.disabled = busy || index === 0;
        nextButton.disabled = busy || index === pages.length - 1;
        card.querySelectorAll("button").forEach(function (button) {
            if (button !== previousButton && button !== nextButton) {
                button.disabled = busy;
            }
        });
        card.setAttribute(
            "aria-label",
            "Stran " + (index + 1) + " od " + pages.length + ", " + item.fileName + ", izvirna stran " + item.sourcePage
        );
    }

    function actionButton(action, text, label) {
        const button = document.createElement("button");
        button.className = "pdf-page-action";
        button.type = "button";
        button.dataset.action = action;
        button.textContent = text;
        button.title = label;
        button.setAttribute("aria-label", label);
        return button;
    }

    function createPageCard(item) {
        const card = document.createElement("li");
        card.className = "pdf-page-card";
        card.dataset.pageId = item.id;
        card.draggable = true;
        card.tabIndex = 0;

        const cardHeader = document.createElement("div");
        cardHeader.className = "pdf-page-card-header";
        const position = document.createElement("span");
        position.className = "pdf-page-position";
        const dragHandle = document.createElement("span");
        dragHandle.className = "pdf-drag-handle";
        dragHandle.textContent = "PREMAKNI / DRAG";
        dragHandle.setAttribute("aria-hidden", "true");
        cardHeader.append(position, dragHandle);

        const preview = document.createElement("div");
        preview.className = "pdf-page-preview";
        const placeholder = document.createElement("span");
        placeholder.className = "pdf-page-loading";
        placeholder.textContent = "IZRIS PREDOGLEDA…";
        const canvas = document.createElement("canvas");
        canvas.hidden = true;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "Predogled strani iz " + item.fileName);
        preview.append(placeholder, canvas);

        const information = document.createElement("div");
        information.className = "pdf-page-information";
        const source = document.createElement("strong");
        source.className = "pdf-page-source";
        const rotation = document.createElement("span");
        rotation.className = "pdf-page-rotation";
        information.append(source, rotation);

        const actions = document.createElement("div");
        actions.className = "pdf-page-actions";
        actions.append(
            actionButton("previous", "←", "Premakni stran levo"),
            actionButton("next", "→", "Premakni stran desno"),
            actionButton("rotate-left", "↶", "Zavrti stran za 90 stopinj v levo"),
            actionButton("rotate-right", "↷", "Zavrti stran za 90 stopinj v desno"),
            actionButton("delete", "×", "Odstrani stran")
        );

        card.append(cardHeader, preview, information, actions);
        return card;
    }

    function syncWorkspace() {
        const activeIds = new Set(pages.map(function (page) { return page.id; }));
        pagesList.querySelectorAll(".pdf-page-card").forEach(function (card) {
            if (!activeIds.has(card.dataset.pageId)) {
                thumbnailObserver?.unobserve(card);
                card.remove();
            }
        });

        pages.forEach(function (item, index) {
            let card = pagesList.querySelector('[data-page-id="' + CSS.escape(item.id) + '"]');
            if (!card) {
                card = createPageCard(item);
                pagesList.appendChild(card);
                if (thumbnailObserver) {
                    thumbnailObserver.observe(card);
                } else {
                    scheduleThumbnail(item.id);
                }
            } else {
                pagesList.appendChild(card);
            }
            updateCard(card, item, index);
        });

        const hasPages = pages.length > 0;
        emptyState.hidden = hasPages;
        pagesList.hidden = !hasPages;
        pageCount.textContent = String(pages.length);
        fileCount.textContent = String(documents.size);
        fileHint.textContent = hasPages
            ? "kliknite ali spustite še en PDF"
            : "ali kliknite za izbiro več datotek";
        clearButton.disabled = busy || !hasPages;
        downloadButton.disabled = busy || !hasPages;
        syncShareAction();
    }

    async function renderThumbnail(pageId) {
        const item = pageById(pageId);
        const record = item && documents.get(item.documentId);
        const card = pagesList.querySelector('[data-page-id="' + CSS.escape(pageId) + '"]');
        if (!item || !record || !card) {
            return;
        }

        const canvas = card.querySelector("canvas");
        const placeholder = card.querySelector(".pdf-page-loading");
        const requestedRotation = item.rotation;

        try {
            const sourcePage = await record.viewer.getPage(item.sourcePage);
            const unscaledViewport = sourcePage.getViewport({
                scale: 1,
                rotation: normalizeRotation(sourcePage.rotate + requestedRotation)
            });
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const fitScale = Math.min(224 / unscaledViewport.width, 290 / unscaledViewport.height);
            const viewport = sourcePage.getViewport({
                scale: Math.max(.05, fitScale * pixelRatio),
                rotation: normalizeRotation(sourcePage.rotate + requestedRotation)
            });

            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            canvas.style.width = Math.max(1, Math.floor(viewport.width / pixelRatio)) + "px";
            canvas.style.height = Math.max(1, Math.floor(viewport.height / pixelRatio)) + "px";

            await sourcePage.render({
                canvas,
                viewport,
                background: "rgb(255,255,255)"
            }).promise;

            const latestItem = pageById(pageId);
            if (!latestItem || !card.isConnected) {
                return;
            }
            canvas.dataset.rotation = String(requestedRotation);
            canvas.hidden = false;
            placeholder.hidden = true;
        } catch (error) {
            if (card.isConnected) {
                placeholder.textContent = "PREDOGLEDA NI MOGOČE IZRISATI";
                placeholder.classList.add("is-error");
            }
        }
    }

    function scheduleThumbnail(pageId) {
        if (!pageId || queuedThumbnails.has(pageId)) {
            return;
        }
        queuedThumbnails.add(pageId);
        renderQueue = renderQueue
            .then(function () {
                return renderThumbnail(pageId);
            })
            .catch(function () {
                // A failed thumbnail must not stop the remaining render queue.
            })
            .finally(function () {
                queuedThumbnails.delete(pageId);
                const item = pageById(pageId);
                const card = pagesList.querySelector('[data-page-id="' + CSS.escape(pageId) + '"]');
                const canvas = card && card.querySelector("canvas");
                if (item && canvas && canvas.dataset.rotation !== String(item.rotation)) {
                    scheduleThumbnail(pageId);
                }
            });
    }

    function friendlyLoadError(error, fileName) {
        const message = error && error.message ? error.message : String(error || "");
        if (/encrypt|password/i.test(message)) {
            return "Datoteka »" + fileName + "« je zaščitena z geslom in je ni mogoče združiti.";
        }
        if (/invalid|header|xref|object|pdf/i.test(message)) {
            return "Datoteka »" + fileName + "« ni veljaven ali podprt PDF.";
        }
        return "Datoteke »" + fileName + "« ni bilo mogoče odpreti.";
    }

    async function loadPdf(file) {
        if (!file || (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf")) {
            throw new Error("Datoteka »" + (file?.name || "brez imena") + "« ni PDF.");
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length === 0) {
            throw new Error("Datoteka »" + file.name + "« je prazna.");
        }

        await PDFDocument.load(bytes, { updateMetadata: false });

        const loadingTask = getDocument(Object.assign({ data: bytes.slice() }, PDFJS_OPTIONS));
        loadingTask.onPassword = function (updatePassword) {
            updatePassword(new Error("Password-protected PDFs are not supported."));
        };
        const viewer = await loadingTask.promise;
        if (!viewer.numPages) {
            await viewer.destroy();
            throw new Error("PDF has no pages.");
        }

        invalidatePreparedPdf();
        documentSequence += 1;
        const documentId = "pdf-document-" + documentSequence;
        documents.set(documentId, {
            id: documentId,
            name: file.name,
            bytes,
            viewer
        });

        for (let sourcePage = 1; sourcePage <= viewer.numPages; sourcePage += 1) {
            pageSequence += 1;
            pages.push({
                id: "pdf-page-" + pageSequence,
                documentId,
                fileName: file.name,
                sourcePage,
                sourceIndex: sourcePage - 1,
                rotation: 0
            });
        }
        return viewer.numPages;
    }

    async function addFiles(fileList) {
        if (busy) {
            return;
        }
        const files = Array.from(fileList || []);
        if (!files.length) {
            return;
        }

        setBusy(true);
        let addedFiles = 0;
        let addedPages = 0;
        const errors = [];

        for (const file of files) {
            setStatus("Odpiranje datoteke »" + file.name + "«…", false);
            try {
                addedPages += await loadPdf(file);
                addedFiles += 1;
                syncWorkspace();
            } catch (error) {
                errors.push(friendlyLoadError(error, file.name));
            }
        }

        fileInput.value = "";
        setBusy(false);
        syncWorkspace();

        if (addedFiles) {
            const summary = "Dodano: " + addedFiles + " " + plural(addedFiles, "datoteka", "datoteki", "datotek") +
                " in " + addedPages + " " + plural(addedPages, "stran", "strani", "strani") + ".";
            setStatus(errors.length ? summary + " " + errors.join(" ") : summary, errors.length > 0);
        } else {
            setStatus(errors.join(" ") || "Izbrane datoteke ni bilo mogoče dodati.", true);
        }
    }

    function removePage(pageId) {
        const item = pageById(pageId);
        if (!item) {
            return;
        }
        invalidatePreparedPdf();
        pages = pages.filter(function (page) {
            return page.id !== pageId;
        });
        releaseUnusedDocument(item.documentId);
        syncWorkspace();
        setStatus(
            pages.length ? "Stran je odstranjena. V dokumentu ostaja " + pages.length + " strani." : "Vse strani so odstranjene.",
            false
        );
    }

    function moveAndFocus(pageId, offset) {
        const nextPages = movePage(pages, pageId, offset);
        const orderChanged = nextPages.some(function (page, index) {
            return page !== pages[index];
        });
        if (orderChanged) {
            invalidatePreparedPdf();
        }
        pages = nextPages;
        syncWorkspace();
        pagesList.querySelector('[data-page-id="' + CSS.escape(pageId) + '"]')?.focus();
        setStatus("Vrstni red strani je posodobljen.", false);
    }

    function rotatePage(pageId, amount) {
        const item = pageById(pageId);
        if (!item) {
            return;
        }
        invalidatePreparedPdf();
        item.rotation = normalizeRotation(item.rotation + amount);
        const card = pagesList.querySelector('[data-page-id="' + CSS.escape(pageId) + '"]');
        const canvas = card && card.querySelector("canvas");
        if (canvas) {
            canvas.dataset.rotation = "pending";
        }
        syncWorkspace();
        scheduleThumbnail(pageId);
        setStatus("Stran je zavrtena za " + item.rotation + "° glede na izvirnik.", false);
    }

    function clearWorkspace() {
        if (pages.length || documents.size) {
            invalidatePreparedPdf();
        }
        documents.forEach(function (record) {
            Promise.resolve(record.viewer.destroy()).catch(function () {
                // Clearing the UI is sufficient even if the worker is already gone.
            });
        });
        documents.clear();
        pages = [];
        fileInput.value = "";
        syncWorkspace();
        setStatus("Delovna površina je prazna.", false);
    }

    function safeOutputName() {
        let name = outputName.value.trim()
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
            .replace(/[. ]+$/g, "");
        if (!name) {
            name = "zdruzen-dokument.pdf";
        }
        if (!/\.pdf$/i.test(name)) {
            name += ".pdf";
        }
        outputName.value = name;
        return name;
    }

    async function createPdfFile(name) {
        const output = await PDFDocument.create();
        const copiedPages = new Map();
        const documentIds = Array.from(new Set(pages.map(function (page) {
            return page.documentId;
        })));

        for (const documentId of documentIds) {
            const record = documents.get(documentId);
            if (!record) {
                throw new Error("Missing source document.");
            }
            const source = await PDFDocument.load(record.bytes, { updateMetadata: false });
            const sourceItems = pages.filter(function (page) {
                return page.documentId === documentId;
            });
            const copies = await output.copyPages(source, sourceItems.map(function (page) {
                return page.sourceIndex;
            }));

            sourceItems.forEach(function (item, index) {
                const copy = copies[index];
                copy.setRotation(degrees(normalizeRotation(copy.getRotation().angle + item.rotation)));
                copiedPages.set(item.id, copy);
            });
        }

        pages.forEach(function (page) {
            output.addPage(copiedPages.get(page.id));
        });

        output.setTitle(name.replace(/\.pdf$/i, ""));
        output.setCreator("Delavnica");
        output.setProducer("Delavnica / pdf-lib");
        output.setCreationDate(new Date());

        const bytes = await output.save({
            addDefaultPage: false,
            objectsPerTick: 25,
            useObjectStreams: true
        });
        return new File([bytes], name, { type: pdfFileType });
    }

    function setPdfOutputError(error, action) {
        const message = error && error.message ? error.message : String(error);
        setStatus(
            /encrypt|password/i.test(message)
                ? "Eden od dokumentov je zaščiten z geslom in ga ni mogoče izvoziti."
                : action === "share"
                    ? "PDF-ja ni bilo mogoče pripraviti ali deliti. Preverite dokumente in poskusite znova."
                    : "PDF-ja ni bilo mogoče ustvariti ali shraniti. Preverite dokumente in poskusite znova.",
            true
        );
    }

    async function exportPdf() {
        if (busy || pages.length === 0) {
            return;
        }

        const name = safeOutputName();
        const previousStatus = captureStatus();
        // Open the native picker while the click still carries user activation,
        // before PDF creation yields to any asynchronous work.
        const destinationPromise = fileOutput.prepareSaveDestination({
            suggestedName: name,
            types: pdfPickerTypes
        });
        setBusy(true);
        setStatus("Sestavljanje novega PDF-ja z " + pages.length + " stranmi…", false);

        try {
            const destination = await destinationPromise;
            if (destination.kind === "cancelled") {
                restoreStatus(previousStatus);
                return;
            }

            const file = await createPdfFile(name);
            const result = await fileOutput.writeOrDownload(file, {
                destination,
                fileName: name,
                types: pdfPickerTypes
            });
            if (result.cancelled) {
                restoreStatus(previousStatus);
                return;
            }
            setStatus(
                result.method === "file-system"
                    ? "PDF je ustvarjen in shranjen: " + name + "."
                    : "PDF je ustvarjen in pripravljen za prenos: " + name + ".",
                false
            );
        } catch (error) {
            setPdfOutputError(error, "save");
        } finally {
            setBusy(false);
            syncWorkspace();
        }
    }

    async function sharePdf() {
        if (busy || pages.length === 0 || !pdfSharingAvailable) {
            return;
        }

        if (preparedPdf.file) {
            const file = preparedPdf.file;
            const preparedRevision = preparedPdf.revision;
            const sharedName = file.name;
            try {
                // Invoke share immediately on the second click; awaiting any PDF work
                // here would consume the browser's transient user activation.
                const result = await fileOutput.shareFile(file, {
                    title: sharedName
                });
                if (!result.cancelled) {
                    if (preparedPdf.file === file && preparedPdf.revision === preparedRevision) {
                        preparedPdf.release();
                    }
                    syncShareAction();
                    setStatus("PDF je deljen: " + sharedName + ".", false);
                }
            } catch (error) {
                setPdfOutputError(error, "share");
            }
            return;
        }

        const name = safeOutputName();
        const revision = preparedPdf.revision;
        setBusy(true);
        setStatus("Priprava PDF-ja za deljenje…", false);
        try {
            const file = await createPdfFile(name);
            if (!preparedPdf.set(file, revision)) {
                setStatus("Dokument se je med pripravo spremenil. Pripravite ga znova.", false);
                return;
            }
            setStatus("PDF je pripravljen. Pritisnite DELI PDF za izbiro aplikacije.", false);
        } catch (error) {
            setPdfOutputError(error, "share");
        } finally {
            setBusy(false);
            syncWorkspace();
        }
    }

    fileInput.addEventListener("change", function () {
        addFiles(fileInput.files);
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
        dropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            if (!busy) {
                dropZone.classList.add("is-dragging");
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = "copy";
                }
            }
        });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
        dropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            dropZone.classList.remove("is-dragging");
        });
    });

    dropZone.addEventListener("drop", function (event) {
        if (!busy) {
            addFiles(event.dataTransfer && event.dataTransfer.files);
        }
    });

    clearButton.addEventListener("click", clearWorkspace);
    downloadButton.addEventListener("click", exportPdf);
    shareButton?.addEventListener("click", sharePdf);
    outputName.addEventListener("input", invalidatePreparedPdf);

    pagesList.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");
        const card = button && button.closest(".pdf-page-card");
        if (!button || !card || busy) {
            return;
        }

        const pageId = card.dataset.pageId;
        const actions = {
            previous: function () { moveAndFocus(pageId, -1); },
            next: function () { moveAndFocus(pageId, 1); },
            "rotate-left": function () { rotatePage(pageId, -90); },
            "rotate-right": function () { rotatePage(pageId, 90); },
            delete: function () { removePage(pageId); }
        };
        actions[button.dataset.action]?.();
    });

    pagesList.addEventListener("keydown", function (event) {
        const card = event.target.closest(".pdf-page-card");
        if (!card || busy || event.target.closest("button")) {
            return;
        }
        if (event.altKey && event.key === "ArrowLeft") {
            event.preventDefault();
            moveAndFocus(card.dataset.pageId, -1);
        } else if (event.altKey && event.key === "ArrowRight") {
            event.preventDefault();
            moveAndFocus(card.dataset.pageId, 1);
        }
    });

    pagesList.addEventListener("dragstart", function (event) {
        const card = event.target.closest(".pdf-page-card");
        if (!card || busy) {
            event.preventDefault();
            return;
        }
        draggedPageId = card.dataset.pageId;
        card.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedPageId);
    });

    pagesList.addEventListener("dragover", function (event) {
        const target = event.target.closest(".pdf-page-card");
        if (!target || !draggedPageId || target.dataset.pageId === draggedPageId) {
            return;
        }
        event.preventDefault();
        pagesList.querySelectorAll(".is-drop-before, .is-drop-after").forEach(function (card) {
            card.classList.remove("is-drop-before", "is-drop-after");
        });
        const bounds = target.getBoundingClientRect();
        const placeAfter = window.innerWidth <= 640
            ? event.clientY > bounds.top + bounds.height / 2
            : event.clientX > bounds.left + bounds.width / 2;
        target.classList.add(placeAfter ? "is-drop-after" : "is-drop-before");
        event.dataTransfer.dropEffect = "move";
    });

    pagesList.addEventListener("drop", function (event) {
        const target = event.target.closest(".pdf-page-card");
        if (!target || !draggedPageId) {
            return;
        }
        event.preventDefault();
        const placeAfter = target.classList.contains("is-drop-after");
        const nextPages = reorderPage(pages, draggedPageId, target.dataset.pageId, placeAfter);
        const orderChanged = nextPages.some(function (page, index) {
            return page !== pages[index];
        });
        if (orderChanged) {
            invalidatePreparedPdf();
        }
        pages = nextPages;
        syncWorkspace();
        setStatus("Vrstni red strani je posodobljen.", false);
    });

    pagesList.addEventListener("dragend", function () {
        draggedPageId = "";
        pagesList.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach(function (card) {
            card.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
        });
    });

    syncWorkspace();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdfMerger, { once: true });
} else {
    initPdfMerger();
}
