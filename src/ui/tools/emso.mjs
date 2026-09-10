import { api } from '../services.mjs';
import { core, byId, localizedError, setStatus, utcToday, capAtMaximum } from '../shared.mjs';
export function initEmsoTool() {
    const form = byId("emso-form");
    const dateInput = byId("emso-date");
    const clearDateButton = byId("emso-date-clear");
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

    function syncDateControls(announce) {
        const adultOnly = ageInput.value === "adult";
        if (adultOnly) {
            dateInput.value = "";
        }
        dateInput.disabled = adultOnly;
        clearDateButton.disabled = adultOnly || !dateInput.value;

        if (announce) {
            setStatus(
                status,
                adultOnly
                    ? "Datum rojstva je izklopljen. Ob generiranju bodo starosti naključne in vedno 18+."
                    : "Datum rojstva lahko izberete ali pustite prazen za naključno starost.",
                false
            );
        }
    }

    dateInput.addEventListener("input", function () {
        clearDateButton.disabled = !dateInput.value;
    });

    clearDateButton.addEventListener("click", function () {
        dateInput.value = "";
        syncDateControls(false);
        dateInput.focus();
        setStatus(status, "Datum rojstva je počiščen; uporabljen bo naključen datum.", false);
    });

    ageInput.addEventListener("change", function () {
        syncDateControls(true);
    });

    api.register("emso", {
        apply(args) { countInput.value = String(args.count); dateInput.value = args.date; genderInput.value = args.gender; ageInput.value = args.adultOnly ? "adult" : "any"; syncDateControls(false); },
        progress() { setStatus(status, "Generiranje…", false); },
        render(result, args) { output.value = result.identifiers.join("\n"); outputCount.textContent = result.count + " ZAPISOV"; setStatus(status, args.adultOnly ? "Generirane so naključne osebe, stare najmanj 18 let; vsi zapisi so kontrolno preverjeni." : "Generirano in kontrolno preverjeno v tem brskalniku.", false); },
        error(error) { setStatus(status, localizedError(error), true); },
        settled(cancelled) { if (cancelled) setStatus(status, "Opravilo je preklicano.", false); }
    });
    form.addEventListener("input", () => api.invalidate("emso"));
    form.addEventListener("change", () => api.invalidate("emso"));
    form.addEventListener("submit", event => { event.preventDefault(); void api.execute("generate_emso", { count: core.clampCount(countInput.value, 5000), date: dateInput.value, gender: genderInput.value, adultOnly: ageInput.value === "adult" }, { source: "manual" }); });

    syncDateControls(false);
    form.requestSubmit();
}
