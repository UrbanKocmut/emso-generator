import { api } from '../services.mjs';
import { core, byId, localizedError, setStatus, setValidationState } from '../shared.mjs';
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

export function initJwtTool() {
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
        if (!input.value.trim()) { api.invalidate("jwt"); resetValidation(); setStatus(status, "Za začetek prilepite žeton.", false); return; }
        return api.execute("inspect_jwt", { token: input.value, key: key.value, keyEncoding: keyEncoding.value }, { source: "manual" });
    }
    function renderInspection(result) {
        const parsed = result.structure;
        const analysis = result.claims;
        const algorithm = core.JWT_ALGORITHMS[parsed.algorithm];
        activeToken = input.value.trim();

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

        if (result.signature.state !== "unchecked") {
            const verification = result.signature;
            setValidationState(signatureState, verification.state === "error" ? "NAPAKA" : verification.valid ? "VELJAVNO" : "NEVELJAVNO", verification.valid ? "valid" : "invalid");
            setStatus(status, verification.state === "error" ? localizedError(new Error(verification.message)) : verification.valid ? "Podpis je uspešno preverjen z " + verification.algorithm + "." : "Preverjanje podpisa ni uspelo. Ključ ali žeton se ne ujema.", !verification.valid);
        }
    }
    api.register("jwt", {
        apply(args) { window.clearTimeout(parseTimer); input.value = args.token; key.value = args.key; keyEncoding.value = args.keyEncoding; size.textContent = core.formatBytes(core.utf8Size(args.token)); },
        progress(args) { verifyButton.disabled = true; setValidationState(signatureState, args.verifySignature ? "PREVERJANJE" : "NI PREVERJEN", "neutral"); setStatus(status, args.verifySignature ? "Preverjanje z brskalniškim vmesnikom Web Crypto…" : "Razčlenjevanje žetona…", false); },
        render: renderInspection,
        error(error) { resetValidation(); setValidationState(structureState, error.code === "INVALID_ARGUMENT" ? "NI PREVERJENO" : "NEVELJAVNO", error.code === "INVALID_ARGUMENT" ? "neutral" : "invalid"); setValidationState(timeState, "NI PREVERJENO", "neutral"); setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) { setValidationState(signatureState, "NI PREVERJEN", "neutral"); setStatus(status, "Opravilo je preklicano.", false); verifyButton.disabled = !activeToken; } }
    });
    input.addEventListener("input", function () {
        api.invalidate("jwt"); resetValidation();
        size.textContent = core.formatBytes(core.utf8Size(input.value));
        window.clearTimeout(parseTimer);
        parseTimer = window.setTimeout(parseToken, 180);
    });

    parseButton.addEventListener("click", parseToken);

    clearButton.addEventListener("click", function () {
        window.clearTimeout(parseTimer); api.invalidate("jwt");
        input.value = "";
        key.value = "";
        size.textContent = "0 B";
        resetValidation();
        setStatus(status, "Za začetek prilepite žeton.", false);
        input.focus();
    });

    for (const control of [key, keyEncoding]) control.addEventListener("input", () => { api.invalidate("jwt"); setValidationState(signatureState, "NI PREVERJEN", "neutral"); });
    verifyButton.addEventListener("click", function () {
        if (!input.value.trim()) return parseToken();
        if (!key.value) { setStatus(status, "Vnesite skrivnost ali javni ključ za preverjanje.", true); key.focus(); return; }
        void api.execute("inspect_jwt", { token: input.value, verifySignature: true, key: key.value, keyEncoding: keyEncoding.value }, { source: "manual" });
    });
}
