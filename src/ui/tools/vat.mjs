import { api } from '../services.mjs';
import { core, byId, localizedError, setStatus, capAtMaximum } from '../shared.mjs';
export function initVatTool() {
    const form = byId("vat-form");
    const countInput = byId("vat-count");
    const prefixInput = byId("vat-prefix");
    const output = byId("vat-output");
    const outputCount = byId("vat-output-count");
    const status = byId("vat-status");

    capAtMaximum(countInput, 5000, function () {
        setStatus(status, "Količina je omejena na največ 5.000 zapisov.", false);
    });

    api.register("vat", {
        apply(args) { countInput.value = String(args.count); prefixInput.checked = args.prefix; },
        progress() { setStatus(status, "Generiranje…", false); },
        render(result, args) { output.value = result.identifiers.join("\n"); outputCount.textContent = result.count + " ZAPISOV"; setStatus(status, "Generirano in lokalno preverjeno po modulu 11.", false); },
        error(error) { setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) setStatus(status, "Opravilo je preklicano.", false); }
    });
    form.addEventListener("input", () => api.invalidate("vat"));
    form.addEventListener("change", () => api.invalidate("vat"));
    form.addEventListener("submit", event => { event.preventDefault(); void api.execute("generate_si_tax_numbers", { count: core.clampCount(countInput.value, 5000), prefix: prefixInput.checked }, { source: "manual" }); });

    form.requestSubmit();
}
