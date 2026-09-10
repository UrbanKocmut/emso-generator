import { api } from '../services.mjs';
import { core, byId, localizedError, setStatus } from '../shared.mjs';
const AUTO_FORMAT_LIMIT = 2 * 1024 * 1024;
export function initJsonTool() {
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

        void api.execute("format_json", { text: input.value, indent: indentInput.value === "tab" ? "tab" : Number(indentInput.value), minify: Boolean(minify), sortKeys: sortInput.checked }, { source: "manual" });
    }
    api.register("json", {
        apply(args) {
            window.clearTimeout(formatTimer);
            input.value = args.text; indentInput.value = String(args.indent); sortInput.checked = args.sortKeys;
            inputSize.textContent = core.formatBytes(core.utf8Size(args.text));
        },
        progress() { setStatus(status, "Oblikovanje JSON…", false); },
        render(result, args) { output.value = result.text; outputSize.textContent = core.formatBytes(core.utf8Size(result.text)); setStatus(status, args.minify ? "JSON je veljaven in uspešno strnjen." : "JSON je veljaven in uspešno oblikovan.", false); },
        error(error) { output.value = ""; outputSize.textContent = "0 B"; setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) setStatus(status, "Opravilo je preklicano.", false); }
    });

    input.addEventListener("input", function () {
        api.invalidate("json");
        inputSize.textContent = core.formatBytes(core.utf8Size(input.value));
        window.clearTimeout(formatTimer);
        formatTimer = window.setTimeout(function () {
            format(false, true);
        }, 160);
    });

    formatButton.addEventListener("click", function () { format(false, false); });
    minifyButton.addEventListener("click", function () { format(true, false); });
    indentInput.addEventListener("change", function () { api.invalidate("json"); format(false, true); });
    sortInput.addEventListener("change", function () { api.invalidate("json"); format(false, true); });

    clearButton.addEventListener("click", function () {
        window.clearTimeout(formatTimer); api.invalidate("json");
        input.value = "";
        output.value = "";
        inputSize.textContent = "0 B";
        outputSize.textContent = "0 B";
        setStatus(status, "Prilepite JSON za oblikovanje.", false);
        input.focus();
    });
}
