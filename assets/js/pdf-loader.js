(function () {
    "use strict";

    let loading = null;
    let ready = false;
    const baseUrl = window.DelavnicaRoot || document.baseURI;
    const dropZone = document.getElementById("pdf-drop-zone");
    ["dragover", "drop"].forEach(function (type) {
        // Keep a drop from navigating away while the PDF controller is loading.
        dropZone.addEventListener(type, function (event) { event.preventDefault(); });
    });

    function loadScript(path) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = new URL(path, baseUrl).href;
            script.onload = resolve;
            script.onerror = function () {
                script.remove();
                reject(new Error("Unable to load " + path));
            };
            document.head.append(script);
        });
    }

    function load() {
        if (loading) return loading;
        if (ready) return Promise.resolve(true);
        const input = document.getElementById("pdf-file");
        const status = document.getElementById("pdf-status");
        input.disabled = true;
        status.textContent = "Nalaganje orodja PDF…";
        status.classList.remove("is-error");
        loading = (async function () {
            try {
                // Direct file opening needs PDF.js's classic worker fallback.
                // HTTP(S) uses the module worker on demand inside PDF.js.
                if (window.location.protocol === "file:" && !globalThis.pdfjsWorker) {
                    await loadScript("assets/vendor/pdfjs/pdf.worker.classic.js");
                }
                await loadScript("assets/js/pdf-merger.js");
                ready = true;
                input.disabled = false;
                status.textContent = "Dodajte enega ali več PDF-jev za začetek.";
                return true;
            } catch (error) {
                status.textContent = "Orodja PDF ni bilo mogoče naložiti. Odprite drugo orodje in nato znova PDF.";
                status.classList.add("is-error");
                return false;
            } finally {
                loading = null;
            }
        })();
        return loading;
    }

    window.DelavnicaPdfLoader = { load };
})();
