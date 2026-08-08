(function () {
    "use strict";

    const core = window.ToolboxCore;
    if (!core) {
        throw new Error("ToolboxCore failed to load.");
    }

    const TOOL_ROUTES = ["emso", "vat", "jwt", "json", "qif"];
    const ROUTES = new Set(["overview"].concat(TOOL_ROUTES));
    const ROUTE_TITLES = {
        overview: "Delavnica",
        emso: "Generator EMŠO — Delavnica",
        vat: "Generator SI DDV — Delavnica",
        jwt: "Preverjanje JWT — Delavnica",
        json: "Formatiranje JSON — Delavnica",
        qif: "Sparkasse CSV v QIF — Delavnica"
    };
    const AUTO_FORMAT_LIMIT = 2 * 1024 * 1024;
    const QIF_SETTINGS_STORAGE_KEY = "delavnica.qif.settings.v1";
    let toastTimer = 0;

    function byId(id) {
        return document.getElementById(id);
    }

    function localizedError(error) {
        const message = error && error.message ? error.message : String(error);
        const exact = {
            "There is nothing to copy.": "Ni vsebine za kopiranje.",
            "Clipboard access was denied.": "Dostop do odložišča je bil zavrnjen.",
            "A JWT must contain three dot-separated segments.": "JWT mora vsebovati tri dele, ločene s pikami.",
            "The JWT header must be a JSON object.": "Glava JWT mora biti objekt JSON.",
            "The JWT payload must be a JSON object.": "Vsebina JWT mora biti objekt JSON.",
            "The JWT header is missing a string alg value.": "V glavi JWT manjka besedilna vrednost alg.",
            "Unencoded JWS payloads are not valid JWTs.": "Nekodirane vsebine JWS niso veljavni JWT.",
            "The JWT crit header must be an array of strings.": "Polje crit v glavi JWT mora biti polje besedilnih vrednosti.",
            "An unsecured JWT must have an empty signature segment.": "Nepodpisan JWT mora imeti prazen del za podpis.",
            "A signed JWT must include a signature segment.": "Podpisan JWT mora vsebovati del s podpisom.",
            "Unsigned JWTs are never treated as signature-valid.": "Nepodpisani JWT se nikoli ne šteje kot veljavno podpisan.",
            "Critical JOSE header extensions are not supported by this verifier.": "Ta preverjevalnik ne podpira kritičnih razširitev glave JOSE.",
            "Web Crypto is unavailable in this browser context.": "Web Crypto v tem okolju brskalnika ni na voljo.",
            "A non-empty HMAC secret is required.": "Vnesite neprazno skrivnost HMAC.",
            "Expected an SPKI PEM key with BEGIN PUBLIC KEY markers.": "Pričakovan je javni ključ SPKI PEM z oznakama BEGIN PUBLIC KEY.",
            "Invalid base64url encoding.": "Neveljavno kodiranje base64url.",
            "The CSV ends inside a quoted field.": "Datoteka CSV se konča znotraj polja v narekovajih.",
            "Sparkasse header 'Datum knjiženja' was not found.": "Glava Sparkasse »Datum knjiženja« ni bila najdena.",
            "The QIF type cannot contain a line break.": "Vrsta QIF ne sme vsebovati preloma vrstice."
        };

        if (exact[message]) {
            return exact[message];
        }
        if (message.startsWith("Invalid JWT header:")) {
            return "Neveljavna glava JWT:" + message.slice("Invalid JWT header:".length);
        }
        if (message.startsWith("Invalid JWT payload:")) {
            return "Neveljavna vsebina JWT:" + message.slice("Invalid JWT payload:".length);
        }
        if (message.startsWith("Unsupported JWT algorithm:")) {
            return message.replace("Unsupported JWT algorithm:", "Nepodprt algoritem JWT:");
        }
        if (message.startsWith("Unsupported date token:")) {
            return message.replace("Unsupported date token:", "Nepodprt zapis datuma:");
        }
        if (message.startsWith("Unsupported text encoding:")) {
            return message.replace("Unsupported text encoding:", "Nepodprto kodiranje besedila:");
        }
        if (message.startsWith("Unsupported QIF encoding:")) {
            return message.replace("Unsupported QIF encoding:", "Nepodprto kodiranje QIF:");
        }
        if (/^Line \d+: can't parse date/.test(message)) {
            return message.replace(/^Line (\d+): can't parse date/, "Vrstica $1: datuma ni mogoče razčleniti");
        }
        if (/^Line \d+: no amount/.test(message)) {
            return message.replace(/^Line (\d+): no amount/, "Vrstica $1: manjka znesek");
        }
        if (message.includes("cannot be encoded as Windows-1250")) {
            return message.replace("cannot be encoded as Windows-1250", "ni mogoče kodirati kot Windows-1250");
        }
        if (error instanceof SyntaxError) {
            return "JSON ni veljaven: " + message;
        }
        return message;
    }

    function setStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle("is-error", Boolean(isError));
    }

    function setValidationState(element, text, state) {
        element.textContent = text;
        element.className = "state " + (state || "neutral");
    }

    function showToast(message) {
        const toast = byId("toast");
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.hidden = false;
        toastTimer = window.setTimeout(function () {
            toast.hidden = true;
        }, 1900);
    }

    function getElementText(element) {
        return "value" in element ? element.value : element.textContent;
    }

    async function copyText(value) {
        if (!value) {
            throw new Error("There is nothing to copy.");
        }

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const fallback = document.createElement("textarea");
        fallback.value = value;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (!copied) {
            throw new Error("Clipboard access was denied.");
        }
    }

    function initCopyButtons() {
        document.addEventListener("click", async function (event) {
            const button = event.target.closest("[data-copy-target]");
            if (!button) {
                return;
            }

            const target = byId(button.dataset.copyTarget);
            if (!target) {
                return;
            }

            try {
                await copyText(getElementText(target));
                showToast("KOPIRANO V ODLOŽIŠČE");
            } catch (error) {
                showToast(localizedError(error).toUpperCase());
            }
        });
    }

    function currentRoute() {
        const candidate = window.location.hash.slice(1).toLowerCase();
        return ROUTES.has(candidate) ? candidate : "overview";
    }

    function renderRoute() {
        const route = currentRoute();
        let activeLink = null;

        document.querySelectorAll("[data-panel]").forEach(function (panel) {
            panel.hidden = panel.dataset.panel !== route;
        });

        document.querySelectorAll("[data-route]").forEach(function (link) {
            if (link.dataset.route === route) {
                link.setAttribute("aria-current", "page");
                activeLink = link;
            } else {
                link.removeAttribute("aria-current");
            }
        });

        document.title = ROUTE_TITLES[route];

        const sidebar = document.querySelector(".sidebar");
        if (activeLink && sidebar && sidebar.scrollWidth > sidebar.clientWidth) {
            sidebar.scrollLeft = activeLink.offsetLeft - (sidebar.clientWidth - activeLink.offsetWidth) / 2;
        }
    }

    function initRouter() {
        window.addEventListener("hashchange", renderRoute);
        renderRoute();
    }

    function utcToday() {
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    function latestAdultBirthDate() {
        const date = utcToday();
        const originalMonth = date.getUTCMonth();
        date.setUTCFullYear(date.getUTCFullYear() - 18);
        if (date.getUTCMonth() !== originalMonth) {
            date.setUTCDate(0);
        }
        return date;
    }

    function capAtMaximum(input, maximum, onCap) {
        function enforceMaximum() {
            if (Number(input.value) > maximum) {
                input.value = String(maximum);
                if (onCap) {
                    onCap(maximum);
                }
            }
        }

        input.addEventListener("input", enforceMaximum);
        input.addEventListener("change", enforceMaximum);
    }

    function initEmsoTool() {
        const form = byId("emso-form");
        const dateInput = byId("emso-date");
        const genderInput = byId("emso-gender");
        const ageInput = byId("emso-age");
        const countInput = byId("emso-count");
        const output = byId("emso-output");
        const outputCount = byId("emso-output-count");
        const status = byId("emso-status");

        const today = utcToday();
        dateInput.max = today.toISOString().slice(0, 10);
        capAtMaximum(countInput, 5000, function () {
            setStatus(status, "Količina je omejena na največ 5.000 zapisov.", false);
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const count = core.clampCount(countInput.value, 5000);
            countInput.value = String(count);
            const date = dateInput.value ? core.parseIsoDate(dateInput.value) : null;

            if (dateInput.value && !date) {
                setStatus(status, "Vnesite veljaven koledarski datum.", true);
                return;
            }
            if (date && date > today) {
                setStatus(status, "Datum rojstva ne sme biti v prihodnosti.", true);
                return;
            }
            if (date && ageInput.value === "adult" && date > latestAdultBirthDate()) {
                setStatus(status, "Ta datum rojstva ne ustreza filtru 18+.", true);
                return;
            }

            try {
                const results = core.generateEmsos(count, {
                    date,
                    gender: genderInput.value,
                    adultOnly: ageInput.value === "adult"
                });
                const allValid = results.every(function (value) {
                    return core.validateEmso(value).valid;
                });
                if (!allValid) {
                    throw new Error("Notranje preverjanje EMŠO ni uspelo.");
                }

                output.value = results.join("\n");
                outputCount.textContent = results.length + " ZAPISOV";
                setStatus(status, "Generirano in kontrolno preverjeno v tem brskalniku.", false);
            } catch (error) {
                setStatus(status, localizedError(error), true);
            }
        });

        form.requestSubmit();
    }

    function initVatTool() {
        const form = byId("vat-form");
        const countInput = byId("vat-count");
        const prefixInput = byId("vat-prefix");
        const output = byId("vat-output");
        const outputCount = byId("vat-output-count");
        const status = byId("vat-status");

        capAtMaximum(countInput, 5000, function () {
            setStatus(status, "Količina je omejena na največ 5.000 zapisov.", false);
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            const count = core.clampCount(countInput.value, 5000);
            countInput.value = String(count);

            try {
                const results = core.generateSlovenianVats(count, { prefix: prefixInput.checked });
                const allValid = results.every(function (value) {
                    return core.validateSlovenianVat(value).valid;
                });
                if (!allValid) {
                    throw new Error("Notranje preverjanje davčne številke ni uspelo.");
                }

                output.value = results.join("\n");
                outputCount.textContent = results.length + " ZAPISOV";
                setStatus(status, "Generirano in lokalno preverjeno po modulu 11.", false);
            } catch (error) {
                setStatus(status, localizedError(error), true);
            }
        });

        form.requestSubmit();
    }

    function readableClaimValue(claim, value) {
        if (["exp", "nbf", "iat"].includes(claim) && typeof value === "number") {
            try {
                return new Date(value * 1000).toISOString() + " (" + value + ")";
            } catch (error) {
                return String(value);
            }
        }
        if (typeof value === "string") {
            return value;
        }
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    function renderClaimChecks(analysis) {
        const container = byId("jwt-claims");
        container.replaceChildren();

        const stateLabels = {
            absent: "MANJKA",
            invalid: "NEVELJAVNO",
            valid: "VELJAVNO",
            warning: "OPOZORILO",
            info: "PODATEK"
        };

        function claimMessage(check) {
            if (check.state === "absent") {
                return {
                    exp: "Čas poteka ni določen.",
                    nbf: "Čas začetka veljavnosti ni omejen.",
                    iat: "Čas izdaje ni določen."
                }[check.claim] || "Zahtevek ni podan.";
            }
            if (check.state === "info") {
                return "Zahtevek je prisoten.";
            }
            if (check.claim === "exp") {
                return check.state === "valid" ? "Žeton še ni potekel." : "Žeton je potekel ali ima neveljaven čas poteka.";
            }
            if (check.claim === "nbf") {
                return check.state === "valid" ? "Žeton je že veljaven." : "Žeton še ni začel veljati ali ima neveljaven čas.";
            }
            if (check.claim === "iat") {
                return check.state === "warning" ? "Čas izdaje je v prihodnosti; preverite uro sistema." : "Čas izdaje je smiseln.";
            }
            return check.message;
        }

        analysis.checks.forEach(function (check) {
            const row = document.createElement("div");
            row.className = "claim-row";
            const name = document.createElement("strong");
            const details = document.createElement("span");
            name.textContent = check.claim.toUpperCase() + " / " + (stateLabels[check.state] || check.state.toUpperCase());
            details.textContent = check.value === undefined
                ? claimMessage(check)
                : readableClaimValue(check.claim, check.value) + " — " + claimMessage(check);
            row.append(name, details);
            container.appendChild(row);
        });
    }

    function initJwtTool() {
        const input = byId("jwt-input");
        const parseButton = byId("jwt-parse");
        const clearButton = byId("jwt-clear");
        const results = byId("jwt-results");
        const headerOutput = byId("jwt-header-output");
        const payloadOutput = byId("jwt-payload-output");
        const size = byId("jwt-size");
        const status = byId("jwt-status");
        const structureState = byId("jwt-structure-state");
        const timeState = byId("jwt-time-state");
        const signatureState = byId("jwt-signature-state");
        const key = byId("jwt-key");
        const keyLabel = byId("jwt-key-label");
        const keyEncodingField = byId("jwt-key-encoding-field");
        const keyEncoding = byId("jwt-key-encoding");
        const verifyButton = byId("jwt-verify");
        const verifyHelp = byId("jwt-verify-help");
        let parseTimer = 0;
        let activeToken = "";

        function resetValidation() {
            activeToken = "";
            results.hidden = true;
            headerOutput.textContent = "";
            payloadOutput.textContent = "";
            setValidationState(structureState, "ČAKANJE", "neutral");
            setValidationState(timeState, "ČAKANJE", "neutral");
            setValidationState(signatureState, "NI PREVERJEN", "neutral");
            verifyButton.disabled = true;
        }

        function parseToken() {
            const token = input.value.trim();
            if (!token) {
                resetValidation();
                setStatus(status, "Za začetek prilepite žeton.", false);
                return;
            }

            try {
                const parsed = core.parseJwt(token);
                const analysis = core.analyzeJwtClaims(parsed.payload);
                const algorithm = core.JWT_ALGORITHMS[parsed.algorithm];
                activeToken = parsed.token;

                headerOutput.textContent = JSON.stringify(parsed.header, null, 2);
                payloadOutput.textContent = JSON.stringify(parsed.payload, null, 2);
                renderClaimChecks(analysis);
                results.hidden = false;

                setValidationState(structureState, "VELJAVNO", "valid");
                setValidationState(timeState, analysis.valid ? "VELJAVNO" : "NEVELJAVNO", analysis.valid ? "valid" : "invalid");
                setValidationState(signatureState, "NI PREVERJEN", "neutral");

                if (algorithm) {
                    const usesSecret = algorithm.family === "hmac";
                    keyLabel.textContent = usesSecret ? "Skrivnost HMAC" : "Javni ključ PEM (SPKI)";
                    key.placeholder = usesSecret ? "Vnesite skupno skrivnost" : "-----BEGIN PUBLIC KEY-----";
                    keyEncodingField.hidden = !usesSecret;
                    verifyButton.disabled = false;
                    verifyHelp.textContent = "Zaznan algoritem " + parsed.algorithm + ". " + (usesSecret
                        ? "Vnesite skupno skrivnost, s katero je bil žeton podpisan."
                        : "Prilepite ustrezni javni ključ SPKI.");
                } else {
                    keyLabel.textContent = "Ključ za preverjanje";
                    keyEncodingField.hidden = true;
                    verifyButton.disabled = true;
                    verifyHelp.textContent = parsed.algorithm.toLowerCase() === "none"
                        ? "Nepodpisani žetoni se razčlenijo, vendar se nikoli ne označijo kot veljavno podpisani."
                        : "Lokalni preverjevalnik tega algoritma ne podpira.";
                }

                setStatus(
                    status,
                    "Žeton " + parsed.algorithm + " je razčlenjen. Zahtevki so preverjeni, podpis pa še ne.",
                    !analysis.valid
                );
            } catch (error) {
                activeToken = "";
                results.hidden = true;
                setValidationState(structureState, "NEVELJAVNO", "invalid");
                setValidationState(timeState, "NI PREVERJENO", "neutral");
                setValidationState(signatureState, "NI PREVERJEN", "neutral");
                verifyButton.disabled = true;
                setStatus(status, localizedError(error), true);
            }
        }

        input.addEventListener("input", function () {
            size.textContent = core.formatBytes(core.utf8Size(input.value));
            window.clearTimeout(parseTimer);
            parseTimer = window.setTimeout(parseToken, 180);
        });

        parseButton.addEventListener("click", parseToken);

        clearButton.addEventListener("click", function () {
            input.value = "";
            key.value = "";
            size.textContent = "0 B";
            resetValidation();
            setStatus(status, "Za začetek prilepite žeton.", false);
            input.focus();
        });

        verifyButton.addEventListener("click", async function () {
            if (!activeToken) {
                parseToken();
                return;
            }
            if (!key.value) {
                setStatus(status, "Vnesite skrivnost ali javni ključ za preverjanje.", true);
                key.focus();
                return;
            }

            const tokenBeingVerified = activeToken;
            verifyButton.disabled = true;
            setValidationState(signatureState, "PREVERJANJE", "neutral");
            setStatus(status, "Preverjanje z brskalniškim vmesnikom Web Crypto…", false);

            try {
                const verification = await core.verifyJwtSignature(tokenBeingVerified, key.value, {
                    keyEncoding: keyEncoding.value
                });
                if (tokenBeingVerified !== activeToken) {
                    return;
                }
                setValidationState(
                    signatureState,
                    verification.valid ? "VELJAVNO" : "NEVELJAVNO",
                    verification.valid ? "valid" : "invalid"
                );
                setStatus(
                    status,
                    verification.valid
                        ? "Podpis je uspešno preverjen z " + verification.algorithm + "."
                        : "Preverjanje podpisa ni uspelo. Ključ ali žeton se ne ujema.",
                    !verification.valid
                );
            } catch (error) {
                if (tokenBeingVerified === activeToken) {
                    setValidationState(signatureState, "NAPAKA", "invalid");
                    setStatus(status, localizedError(error), true);
                }
            } finally {
                if (tokenBeingVerified === activeToken) {
                    verifyButton.disabled = false;
                }
            }
        });
    }

    function initJsonTool() {
        const input = byId("json-input");
        const output = byId("json-output");
        const indentInput = byId("json-indent");
        const sortInput = byId("json-sort");
        const inputSize = byId("json-input-size");
        const outputSize = byId("json-output-size");
        const status = byId("json-status");
        const formatButton = byId("json-format");
        const minifyButton = byId("json-minify");
        const clearButton = byId("json-clear");
        let formatTimer = 0;

        function format(minify, automatic) {
            const source = input.value.trim();
            if (!source) {
                output.value = "";
                outputSize.textContent = "0 B";
                setStatus(status, "Prilepite JSON za oblikovanje.", false);
                return;
            }

            if (automatic && source.length > AUTO_FORMAT_LIMIT) {
                setStatus(status, "Zaznan je velik vnos. Ko ste pripravljeni, pritisnite OBLIKUJ.", false);
                return;
            }

            const indent = indentInput.value === "tab" ? "\t" : Number(indentInput.value);
            try {
                const result = core.formatJson(source, {
                    indent,
                    minify: Boolean(minify),
                    sortKeys: sortInput.checked
                });
                output.value = result;
                outputSize.textContent = core.formatBytes(core.utf8Size(result));
                setStatus(
                    status,
                    minify ? "JSON je veljaven in uspešno strnjen." : "JSON je veljaven in uspešno oblikovan.",
                    false
                );
            } catch (error) {
                output.value = "";
                outputSize.textContent = "0 B";
                setStatus(status, localizedError(error), true);
            }
        }

        input.addEventListener("input", function () {
            inputSize.textContent = core.formatBytes(core.utf8Size(input.value));
            window.clearTimeout(formatTimer);
            formatTimer = window.setTimeout(function () {
                format(false, true);
            }, 160);
        });

        formatButton.addEventListener("click", function () { format(false, false); });
        minifyButton.addEventListener("click", function () { format(true, false); });
        indentInput.addEventListener("change", function () { format(false, true); });
        sortInput.addEventListener("change", function () { format(false, true); });

        clearButton.addEventListener("click", function () {
            input.value = "";
            output.value = "";
            inputSize.textContent = "0 B";
            outputSize.textContent = "0 B";
            setStatus(status, "Prilepite JSON za oblikovanje.", false);
            input.focus();
        });
    }

    function initQifTool() {
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
        const copyButton = byId("qif-copy");
        const clearButton = byId("qif-clear");
        const output = byId("qif-output");
        const outputCount = byId("qif-output-count");
        const outputNote = byId("qif-output-note");
        const status = byId("qif-status");
        const previewLimit = 80000;
        let selectedFile = null;
        let convertedQif = "";
        let converting = false;

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
            convertedQif = "";
            output.value = "";
            outputCount.textContent = "0 TRANSAKCIJ";
            outputNote.textContent = "Pretvorjena ni še nobena datoteka.";
            downloadButton.disabled = true;
            copyButton.disabled = true;
        }

        function selectFile(file) {
            if (!file) {
                return;
            }
            selectedFile = file;
            fileName.textContent = file.name + " — " + core.formatBytes(file.size);
            resetOutput();
            setStatus(status, "Datoteka je izbrana. Lokalna pretvorba…", false);
            convertSelectedFile();
        }

        async function convertSelectedFile() {
            if (converting) {
                return;
            }
            if (!selectedFile) {
                setStatus(status, "Najprej izberite izvoz CSV banke Sparkasse.", true);
                fileInput.focus();
                return;
            }

            converting = true;
            convertButton.disabled = true;
            setStatus(status, "Branje in pretvarjanje datoteke " + selectedFile.name + "…", false);

            try {
                const bytes = new Uint8Array(await selectedFile.arrayBuffer());
                const decoded = core.decodeTextBytes(bytes, csvEncoding.value);
                const result = core.convertSparkasseCsv(decoded.text, {
                    qifType: qifType.value,
                    inputDateFormat: inputDate.value.trim(),
                    outputDateFormat: outputDate.value.trim(),
                    appendCode: appendCode.checked,
                    stopOnError: stopOnErrors.checked
                });

                convertedQif = result.qif;
                const truncated = convertedQif.length > previewLimit;
                output.value = truncated
                    ? convertedQif.slice(0, previewLimit) + "\n… PREDOGLED JE SKRAJŠAN …\n"
                    : convertedQif;
                outputCount.textContent = result.transactionCount + " TRANSAKCIJ";
                outputNote.textContent = [
                    "Vhodno kodiranje: " + decoded.encoding + ".",
                    result.warningCount ? "Preskočene napačne vrstice: " + result.warningCount + "." : "Brez opozoril pri razčlenjevanju.",
                    truncated ? "Predogled je skrajšan; prenos vsebuje celoten QIF." : "Predogled vsebuje celoten QIF."
                ].join(" ");
                downloadButton.disabled = false;
                copyButton.disabled = false;
                setStatus(
                    status,
                    "Pretvorjenih transakcij: " + result.transactionCount +
                        (result.warningCount ? ". Opozoril: " + result.warningCount + "." : "."),
                    false
                );
            } catch (error) {
                resetOutput();
                setStatus(status, localizedError(error), true);
            } finally {
                converting = false;
                convertButton.disabled = false;
            }
        }

        function outputFileName() {
            if (!selectedFile) {
                return "sparkasse.qif";
            }
            const withoutExtension = selectedFile.name.replace(/\.[^.]+$/, "");
            return (withoutExtension || "sparkasse") + ".qif";
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

        [csvEncoding, qifType, inputDate, outputDate, appendCode, stopOnErrors].forEach(function (control) {
            control.addEventListener("input", function () {
                if (selectedFile && convertedQif) {
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

        downloadButton.addEventListener("click", function () {
            if (!convertedQif) {
                return;
            }

            try {
                const bytes = core.encodeTextBytes(convertedQif, outputEncoding.value);
                const blob = new Blob([bytes], { type: "application/x-qif" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = outputFileName();
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                showToast("DATOTEKA QIF JE PRIPRAVLJENA");
            } catch (error) {
                setStatus(status, localizedError(error), true);
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

    function initKeyboardShortcuts() {
        document.addEventListener("keydown", function (event) {
            if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
                return;
            }

            const route = currentRoute();
            const action = {
                emso: function () { byId("emso-form").requestSubmit(); },
                vat: function () { byId("vat-form").requestSubmit(); },
                jwt: function () { byId("jwt-parse").click(); },
                json: function () { byId("json-format").click(); },
                qif: function () { byId("qif-form").requestSubmit(); }
            }[route];

            if (action) {
                event.preventDefault();
                action();
            }
        });
    }

    function initSwipeNavigation() {
        const surface = byId("main-content");
        let gesture = null;

        function resetGesture() {
            gesture = null;
        }

        surface.addEventListener("touchstart", function (event) {
            if (window.innerWidth > 860 || event.touches.length !== 1) {
                resetGesture();
                return;
            }

            const target = event.target instanceof Element ? event.target : null;
            if (target && target.closest("a, button, input, select, textarea, label, [contenteditable='true']")) {
                resetGesture();
                return;
            }

            const touch = event.touches[0];
            gesture = {
                identifier: touch.identifier,
                x: touch.clientX,
                y: touch.clientY
            };
        }, { passive: true });

        surface.addEventListener("touchend", function (event) {
            if (!gesture) {
                return;
            }

            const start = gesture;
            resetGesture();
            const touch = Array.from(event.changedTouches).find(function (candidate) {
                return candidate.identifier === start.identifier;
            });
            if (!touch) {
                return;
            }

            const horizontalDistance = touch.clientX - start.x;
            const verticalDistance = touch.clientY - start.y;
            const minimumDistance = Math.min(90, Math.max(56, surface.clientWidth * 0.14));
            if (
                Math.abs(horizontalDistance) < minimumDistance ||
                Math.abs(horizontalDistance) < Math.abs(verticalDistance) * 1.35
            ) {
                return;
            }

            const routeIndex = TOOL_ROUTES.indexOf(currentRoute());
            if (routeIndex === -1) {
                return;
            }
            const nextIndex = routeIndex + (horizontalDistance < 0 ? 1 : -1);
            if (nextIndex >= 0 && nextIndex < TOOL_ROUTES.length) {
                window.location.hash = TOOL_ROUTES[nextIndex];
            }
        }, { passive: true });

        surface.addEventListener("touchcancel", resetGesture, { passive: true });
    }

    function init() {
        initRouter();
        initCopyButtons();
        initEmsoTool();
        initVatTool();
        initJwtTool();
        initJsonTool();
        initQifTool();
        initKeyboardShortcuts();
        initSwipeNavigation();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
