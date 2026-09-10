export const core = window.ToolboxCore;
export const fileOutput = window.DelavnicaFileOutput;
let toastTimer = 0;
export function byId(id) {
    return document.getElementById(id);
}

export function localizedError(error) {
    const operationErrors = {
        INVALID_ARGUMENT: "Parametri niso veljavni. Preverite obvezna polja, dovoljene možnosti in obsege v navodilih za agente.",
        FILE_NOT_FOUND: "Izbrana datoteka ni več na voljo v tej delovni površini. Izberite jo znova.",
        ARTIFACT_NOT_FOUND: "Pripravljena datoteka ni več na voljo. Znova ustvarite rezultat.",
        LIMIT_EXCEEDED: "Presežena je omejitev velikosti datotek ali rezultatov. Počistite delovno površino ali uporabite manjše datoteke.",
        INVALID_PDF: "PDF-ja ni bilo mogoče sestaviti. Preverite datoteke, številke strani in zaščito z geslom.",
        CANCELLED: "Opravilo je preklicano."
    };
    if (operationErrors[error?.code]) return operationErrors[error.code];
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

export function setStatus(element, message, isError) {
    element.textContent = message;
    element.classList.toggle("is-error", Boolean(isError));
}

export function setValidationState(element, text, state) {
    element.textContent = text;
    element.className = "state " + (state || "neutral");
}

export function showToast(message) {
    const toast = byId("toast");
    window.clearTimeout(toastTimer);
    const revision = String((Number(toast.dataset.toastRevision) || 0) + 1);
    toast.dataset.toastRevision = revision;
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () {
        if (toast.dataset.toastRevision === revision) {
            toast.hidden = true;
        }
    }, 1900);
}

export function getElementText(element) {
    return "value" in element ? element.value : element.textContent;
}

export async function copyText(value) {
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

export function initCopyButtons() {
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

export function utcToday() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function capAtMaximum(input, maximum, onCap) {
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
