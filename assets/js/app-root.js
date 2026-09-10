(function () {
    "use strict";
    // Resolve once, before history navigation can change the document URL.
    window.DelavnicaRoot = new URL("../../", document.currentScript.src).href;
})();
