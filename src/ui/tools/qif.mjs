import { api, files, showArtifact } from '../services.mjs';
import { core, fileOutput, byId, localizedError, setStatus, showToast, copyText } from '../shared.mjs';
const QIF_SETTINGS_STORAGE_KEY = "delavnica.qif.settings.v1";
export function initQifTool() {
    const form = byId("qif-form");
    const fileInput = byId("qif-file");
    const dropZone = byId("qif-drop-zone");
    const fileName = byId("qif-file-name");
    const csvEncoding = byId("qif-csv-encoding");
    const outputEncoding = byId("qif-output-encoding");
    const qifType = byId("qif-type");
    const inputDate = byId("qif-input-date");
    const outputDate = byId("qif-output-date");
    const appendCode = byId("qif-append-code");
    const stopOnErrors = byId("qif-stop-errors");
    const rememberSettings = byId("qif-remember-settings");
    const convertButton = byId("qif-convert");
    const downloadButton = byId("qif-download");
    const shareButton = byId("qif-share");
    const copyButton = byId("qif-copy");
    const clearButton = byId("qif-clear");
    const output = byId("qif-output");
    const outputCount = byId("qif-output-count");
    const outputNote = byId("qif-output-note");
    const status = byId("qif-status");
    const previewLimit = 80000;
    let selectedFile = null;
    let selectedFileId = null;
    let selectedText = null;
    let artifactName = "";
    let convertedQif = "";
    const qifFileType = "application/x-qif";
    const qifPickerTypes = [{
        description: "Datoteka QIF",
        accept: { "application/x-qif": [".qif"] }
    }];
    const qifSharingAvailable = Boolean(
        shareButton &&
        typeof window.File === "function" &&
        fileOutput.canShare(new File([""], "delavnica.qif", { type: qifFileType }))
    );

    if (shareButton) {
        shareButton.hidden = !qifSharingAvailable;
    }

    function selectHasValue(select, value) {
        return Array.from(select.options).some(function (option) {
            return option.value === value;
        });
    }

    function restoreSettings() {
        try {
            const raw = window.localStorage.getItem(QIF_SETTINGS_STORAGE_KEY);
            if (!raw) {
                return false;
            }
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== "object") {
                return false;
            }

            if (selectHasValue(csvEncoding, saved.csvEncoding)) {
                csvEncoding.value = saved.csvEncoding;
            }
            if (selectHasValue(outputEncoding, saved.outputEncoding)) {
                outputEncoding.value = saved.outputEncoding;
            }
            if (selectHasValue(qifType, saved.qifType)) {
                qifType.value = saved.qifType;
            }
            if (typeof saved.inputDateFormat === "string" && saved.inputDateFormat.length <= 32) {
                inputDate.value = saved.inputDateFormat;
            }
            if (typeof saved.outputDateFormat === "string" && saved.outputDateFormat.length <= 32) {
                outputDate.value = saved.outputDateFormat;
            }
            appendCode.checked = saved.appendCode === true;
            stopOnErrors.checked = saved.stopOnError === true;
            rememberSettings.checked = true;
            return true;
        } catch (error) {
            return false;
        }
    }

    function persistSettings() {
        if (!rememberSettings.checked) {
            return true;
        }
        try {
            window.localStorage.setItem(QIF_SETTINGS_STORAGE_KEY, JSON.stringify({
                csvEncoding: csvEncoding.value,
                outputEncoding: outputEncoding.value,
                qifType: qifType.value,
                inputDateFormat: inputDate.value,
                outputDateFormat: outputDate.value,
                appendCode: appendCode.checked,
                stopOnError: stopOnErrors.checked
            }));
            return true;
        } catch (error) {
            return false;
        }
    }

    function removeStoredSettings() {
        try {
            window.localStorage.removeItem(QIF_SETTINGS_STORAGE_KEY);
        } catch (error) {
            // Storage can be unavailable in locked-down browser contexts.
        }
    }

    function resetOutput() {
        artifactName = "";
        convertedQif = "";
        output.value = "";
        outputCount.textContent = "0 TRANSAKCIJ";
        outputNote.textContent = "Pretvorjena ni še nobena datoteka.";
        downloadButton.disabled = true;
        if (shareButton) {
            shareButton.disabled = true;
        }
        copyButton.disabled = true;
    }

    function displayTextSource(text) {
        byId("qif-source-text")?.remove();
        if (text === null) return;
        const details = document.createElement("details"); details.id = "qif-source-text";
        const summary = document.createElement("summary"); summary.textContent = "VHODNO BESEDILO CSV";
        const area = document.createElement("textarea"); area.className = "code-input"; area.readOnly = true; area.value = text; area.setAttribute("aria-label", "Vhodno besedilo CSV");
        details.append(summary, area); dropZone.after(details);
    }
    function selectFile(file) {
        if (!file) return;
        api.invalidate("qif");
        try {
            const id = files.add(file, "qif");
            if (selectedFileId && selectedFileId !== id) files.release(selectedFileId);
            selectedFile = file; selectedFileId = id; selectedText = null;
            displayTextSource(null);
            fileName.textContent = file.name + " — " + core.formatBytes(file.size);
            resetOutput();
            void convertSelectedFile();
        } catch (error) { setStatus(status, localizedError(error), true); }
    }
    function convertSelectedFile() {
        if (!selectedFileId && selectedText === null) { setStatus(status, "Najprej izberite izvoz CSV banke Sparkasse.", true); fileInput.focus(); return; }
        const source = selectedFileId ? { fileId: selectedFileId } : { text: selectedText };
        return api.execute("convert_sparkasse_csv", { ...source, csvEncoding: csvEncoding.value, outputEncoding: outputEncoding.value, qifType: qifType.value,
            inputDateFormat: inputDate.value.trim(), outputDateFormat: outputDate.value.trim(), appendCode: appendCode.checked, stopOnError: stopOnErrors.checked }, { source: "manual" });
    }
    api.register("qif", {
        apply(args) {
            if (args.fileId) {
                const record = files.get(args.fileId, "qif");
                selectedFile = record.file; selectedFileId = record.id; selectedText = null;
                fileName.textContent = record.file.name + " — " + core.formatBytes(record.file.size);
            } else {
                files.clear("qif"); selectedFile = null; selectedFileId = null; selectedText = args.text; fileInput.value = "";
                fileName.textContent = "Vhodno besedilo — " + core.formatBytes(core.utf8Size(args.text));
            }
            displayTextSource(selectedText);
            csvEncoding.value = args.csvEncoding; outputEncoding.value = args.outputEncoding; qifType.value = args.qifType;
            inputDate.value = args.inputDateFormat; outputDate.value = args.outputDateFormat; appendCode.checked = args.appendCode; stopOnErrors.checked = args.stopOnError;
        },
        progress() { convertButton.disabled = true; resetOutput(); setStatus(status, "Branje in pretvarjanje podatkov…", false); },
        render(result) {
            convertedQif = result.qif; artifactName = result.artifact.filename;
            const truncated = convertedQif.length > previewLimit;
            output.value = truncated ? convertedQif.slice(0, previewLimit) + "\n… PREDOGLED JE SKRAJŠAN …\n" : convertedQif;
            outputCount.textContent = result.count + " TRANSAKCIJ";
            outputNote.textContent = ["Vhodno kodiranje: " + result.inputEncoding + ".", result.warningCount ? "Preskočene napačne vrstice: " + result.warningCount + "." : "Brez opozoril pri razčlenjevanju.", truncated ? "Predogled je skrajšan; prenos vsebuje celoten QIF." : "Predogled vsebuje celoten QIF.", ...result.warnings.map(message => localizedError(new Error(message)))].join(" ");
            downloadButton.disabled = false; if (shareButton && qifSharingAvailable) shareButton.disabled = false; copyButton.disabled = false;
            setStatus(status, "Pretvorjenih transakcij: " + result.count + (result.warningCount ? ". Opozoril: " + result.warningCount + "." : "."), false);
            showArtifact("qif", result.artifact);
        },
        error(error) { resetOutput(); setStatus(status, localizedError(error), true); },
        settled(cancelled) { convertButton.disabled = false; if (cancelled) setStatus(status, "Opravilo je preklicano.", false); }
    });

    function outputFileName() {
        if (artifactName) return artifactName;
        if (!selectedFile) {
            return "sparkasse.qif";
        }
        const withoutExtension = selectedFile.name.replace(/\.[^.]+$/, "");
        return (withoutExtension || "sparkasse") + ".qif";
    }

    function outputBlob() {
        const bytes = core.encodeTextBytes(convertedQif, outputEncoding.value);
        return new Blob([bytes], { type: qifFileType });
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        convertSelectedFile();
    });

    fileInput.addEventListener("change", function () {
        selectFile(fileInput.files && fileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
        dropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            dropZone.classList.add("is-dragging");
        });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
        dropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            dropZone.classList.remove("is-dragging");
        });
    });

    dropZone.addEventListener("drop", function (event) {
        selectFile(event.dataTransfer && event.dataTransfer.files[0]);
    });

    [csvEncoding, outputEncoding, qifType, inputDate, outputDate, appendCode, stopOnErrors].forEach(function (control) {
        control.addEventListener("input", function () {
            api.invalidate("qif");
            if ((selectedFile || selectedText !== null) && convertedQif) {
                resetOutput();
                setStatus(status, "Možnosti so spremenjene. Znova pretvorite izbrano datoteko.", false);
            }
        });
    });

    [csvEncoding, outputEncoding, qifType, inputDate, outputDate, appendCode, stopOnErrors].forEach(function (control) {
        control.addEventListener("input", function () {
            if (rememberSettings.checked && !persistSettings()) {
                rememberSettings.checked = false;
                setStatus(status, "Brskalnik ni dovolil lokalnega shranjevanja nastavitev.", true);
            }
        });
    });

    rememberSettings.addEventListener("change", function () {
        if (rememberSettings.checked) {
            if (persistSettings()) {
                setStatus(status, "Nastavitve so shranjene samo v tem brskalniku.", false);
            } else {
                rememberSettings.checked = false;
                setStatus(status, "Brskalnik ni dovolil lokalnega shranjevanja nastavitev.", true);
            }
        } else {
            removeStoredSettings();
            setStatus(status, "Shranjene nastavitve so odstranjene iz tega brskalnika.", false);
        }
    });

    downloadButton.addEventListener("click", async function () {
        if (!convertedQif) {
            return;
        }

        try {
            const name = outputFileName();
            const result = await fileOutput.writeOrDownload(outputBlob(), {
                fileName: name,
                types: qifPickerTypes
            });
            if (!result.cancelled) {
                showToast(result.method === "file-system"
                    ? "DATOTEKA QIF JE SHRANJENA"
                    : "DATOTEKA QIF JE PRIPRAVLJENA");
            }
        } catch (error) {
            setStatus(status, "Datoteke QIF ni bilo mogoče shraniti. Poskusite znova.", true);
        }
    });

    shareButton?.addEventListener("click", async function () {
        if (!convertedQif || !qifSharingAvailable) {
            return;
        }

        try {
            const name = outputFileName();
            const file = new File([outputBlob()], name, { type: qifFileType });
            const result = await fileOutput.shareFile(file, { title: name });
            if (!result.cancelled) {
                showToast("DATOTEKA QIF JE DELJENA");
            }
        } catch (error) {
            setStatus(status, "Datoteke QIF ni bilo mogoče deliti. Poskusite znova.", true);
        }
    });

    copyButton.addEventListener("click", async function () {
        try {
            await copyText(convertedQif);
            showToast("QIF JE KOPIRAN V ODLOŽIŠČE");
        } catch (error) {
            showToast(localizedError(error).toUpperCase());
        }
    });

    clearButton.addEventListener("click", function () {
        api.invalidate("qif"); files.clear("qif"); selectedFileId = null; selectedText = null; displayTextSource(null);
        selectedFile = null;
        fileInput.value = "";
        fileName.textContent = "ali kliknite za izbiro";
        resetOutput();
        setStatus(status, "Za začetek izberite izvoz CSV banke Sparkasse.", false);
    });

    if (restoreSettings()) {
        setStatus(status, "Shranjene nastavitve so obnovljene iz tega brskalnika.", false);
    }
}
