(function () {
    "use strict";

    const actionButtons = Array.from(document.querySelectorAll("[data-pwa-action]"));
    const standaloneQuery = typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : { matches: false };
    let installPrompt = null;
    let waitingWorker = null;
    let updateRequested = false;
    let isReloading = false;
    let toastTimer = 0;

    function isStandalone() {
        return standaloneQuery.matches || window.navigator.standalone === true;
    }

    function actionMode() {
        if (waitingWorker) {
            return "update";
        }
        if (installPrompt && !isStandalone()) {
            return "install";
        }
        return "";
    }

    function renderActions() {
        const mode = actionMode();
        actionButtons.forEach(function (button) {
            const surface = typeof button.closest === "function"
                ? button.closest("[data-pwa-surface]")
                : null;
            button.hidden = !mode;
            button.disabled = updateRequested;
            button.dataset.pwaMode = mode;
            button.textContent = mode === "update"
                ? (button.dataset.pwaUpdateLabel || "POSODOBI")
                : (button.dataset.pwaInstallLabel || "NAMESTI");
            button.setAttribute("aria-label", mode === "update"
                ? "Posodobi Delavnico"
                : "Namesti Delavnico");
            if (surface) {
                surface.hidden = !mode;
                surface.dataset.pwaMode = mode;
                surface.querySelectorAll("[data-pwa-copy]").forEach(function (copy) {
                    copy.hidden = copy.dataset.pwaCopy !== mode;
                });
            }
            if (updateRequested) {
                button.setAttribute("aria-busy", "true");
            } else {
                button.removeAttribute("aria-busy");
            }
        });
    }

    function showToast(message) {
        const toast = document.getElementById("toast");
        if (!toast) {
            return;
        }
        window.clearTimeout(toastTimer);
        const revision = String((Number(toast.dataset.toastRevision) || 0) + 1);
        toast.dataset.toastRevision = revision;
        toast.textContent = message;
        toast.hidden = false;
        toastTimer = window.setTimeout(function () {
            if (toast.dataset.toastRevision === revision) {
                toast.hidden = true;
            }
        }, 2600);
    }

    async function runInstall() {
        if (!installPrompt) {
            return;
        }
        const prompt = installPrompt;
        installPrompt = null;
        renderActions();
        try {
            await prompt.prompt();
            await prompt.userChoice;
        } catch (error) {
            // The browser owns the install UI; cancellation and unsupported prompts are silent.
        }
    }

    function runUpdate() {
        if (!waitingWorker || updateRequested) {
            return;
        }
        updateRequested = true;
        renderActions();
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }

    actionButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            if (actionMode() === "update") {
                runUpdate();
            } else {
                runInstall();
            }
        });
    });

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        installPrompt = event;
        renderActions();
    });

    window.addEventListener("appinstalled", function () {
        installPrompt = null;
        renderActions();
        showToast("DELAVNICA JE NAMEŠČENA");
    });

    if (typeof standaloneQuery.addEventListener === "function") {
        standaloneQuery.addEventListener("change", renderActions);
    }

    if (!("serviceWorker" in navigator)) {
        renderActions();
        return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (!updateRequested || isReloading) {
            return;
        }
        isReloading = true;
        window.location.reload();
    });

    navigator.serviceWorker.addEventListener("message", function (event) {
        if (event.data
                && event.data.type === "OFFLINE_READY"
                && !navigator.serviceWorker.controller) {
            showToast("DELAVNICA JE PRIPRAVLJENA ZA DELO BREZ POVEZAVE");
        }
    });

    window.addEventListener("load", async function () {
        try {
            const registration = await navigator.serviceWorker.register("./service-worker.js", {
                scope: "./",
                updateViaCache: "none"
            });

            if (registration.waiting && navigator.serviceWorker.controller) {
                waitingWorker = registration.waiting;
                renderActions();
            }

            function watchInstalling(installingWorker) {
                if (!installingWorker) {
                    return;
                }

                function syncInstalledWorker() {
                    if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                        waitingWorker = registration.waiting || installingWorker;
                        renderActions();
                    }
                }

                installingWorker.addEventListener("statechange", syncInstalledWorker);
                syncInstalledWorker();
            }

            watchInstalling(registration.installing);

            registration.addEventListener("updatefound", function () {
                watchInstalling(registration.installing);
            });

            registration.update().catch(function () {
                // Offline use and browser-managed update checks remain available.
            });
        } catch (error) {
            // The website remains fully usable if service-worker registration is unavailable.
        }
    }, { once: true });

    renderActions();
})();
