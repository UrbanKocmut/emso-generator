(function (global) {
    "use strict";

    function isAbortError(error) {
        return Boolean(error && (error.name === "AbortError" || error.code === 20));
    }

    function normalizedPickerOptions(options) {
        const source = options || {};
        const pickerOptions = {};
        if (source.suggestedName) {
            pickerOptions.suggestedName = source.suggestedName;
        }
        if (Array.isArray(source.types) && source.types.length) {
            pickerOptions.types = source.types;
        }
        return pickerOptions;
    }

    function prepareSaveDestination(options) {
        if (typeof global.showSaveFilePicker !== "function") {
            return Promise.resolve({ kind: "download" });
        }

        let pickerResult;
        try {
            // Keep this call synchronous with the originating click. Browsers require
            // transient user activation before opening the native save dialog.
            pickerResult = global.showSaveFilePicker(normalizedPickerOptions(options));
        } catch (error) {
            pickerResult = Promise.reject(error);
        }

        return Promise.resolve(pickerResult).then(function (handle) {
            return { kind: "file-system", handle };
        }, function (error) {
            if (isAbortError(error)) {
                return { kind: "cancelled" };
            }
            throw error;
        });
    }

    function downloadBlob(blob, fileName) {
        const url = global.URL.createObjectURL(blob);
        const link = global.document.createElement("a");
        link.href = url;
        link.download = fileName;
        global.document.body.appendChild(link);
        link.click();
        link.remove();
        global.setTimeout(function () {
            global.URL.revokeObjectURL(url);
        }, 1000);
    }

    async function writeToHandle(handle, blob) {
        let writable = null;
        try {
            writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (error) {
            if (writable && typeof writable.abort === "function") {
                try {
                    await writable.abort();
                } catch (abortError) {
                    // Preserve the original write error.
                }
            }
            throw error;
        }
    }

    async function writeOrDownload(blob, options) {
        const settings = options || {};
        const fileName = settings.fileName || "datoteka";
        const destination = await (settings.destination || prepareSaveDestination({
            suggestedName: fileName,
            types: settings.types
        }));

        if (destination.kind === "cancelled") {
            return { cancelled: true, method: "file-system" };
        }

        if (destination.kind === "file-system") {
            await writeToHandle(destination.handle, blob);
            return { cancelled: false, method: "file-system" };
        }

        downloadBlob(blob, fileName);
        return { cancelled: false, method: "download" };
    }

    function canShare(file) {
        const navigator = global.navigator;
        if (!file || !navigator || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
            return false;
        }
        try {
            return navigator.canShare({ files: [file] }) === true;
        } catch (error) {
            return false;
        }
    }

    async function shareFile(file, options) {
        if (!canShare(file)) {
            throw new Error("File sharing is unavailable.");
        }

        const shareData = { files: [file] };
        if (options && options.title) {
            shareData.title = options.title;
        }

        try {
            // As with the picker, invoke the native UI before yielding so the call
            // retains the click's transient user activation.
            await global.navigator.share(shareData);
            return { cancelled: false };
        } catch (error) {
            if (isAbortError(error)) {
                return { cancelled: true };
            }
            throw error;
        }
    }

    function createPreparedFileState() {
        let file = null;
        let revision = 0;

        return Object.freeze({
            get file() {
                return file;
            },
            get revision() {
                return revision;
            },
            set: function (nextFile, expectedRevision) {
                if (expectedRevision !== undefined && expectedRevision !== revision) {
                    return false;
                }
                file = nextFile;
                return true;
            },
            invalidate: function () {
                revision += 1;
                file = null;
            },
            release: function () {
                file = null;
            }
        });
    }

    global.DelavnicaFileOutput = Object.freeze({
        prepareSaveDestination,
        writeOrDownload,
        canShare,
        shareFile,
        createPreparedFileState,
        isAbortError
    });
})(window);
