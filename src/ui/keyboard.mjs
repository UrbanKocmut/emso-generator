import { byId } from './shared.mjs';
import { currentRoute } from './router.mjs';
export function initKeyboardShortcuts() {
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
            qif: function () { byId("qif-form").requestSubmit(); },
            pdf: function () { byId("pdf-download").click(); },
            xml: function () { byId("xml-format").click(); },
            'jwt-generator': function () { byId("jwt-generator-form").requestSubmit(); },
            'image-resizer': function () { byId("image-resizer-form").requestSubmit(); }
        }[route];

        if (action) {
            event.preventDefault();
            action();
        }
    });
}
