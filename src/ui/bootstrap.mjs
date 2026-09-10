import { initCopyButtons } from './shared.mjs';
import { initOperations } from './services.mjs';
import { initToolNavigation, initRouter } from './router.mjs';
import { initKeyboardShortcuts } from './keyboard.mjs';
import { initMobileInfoRail } from './mobile/info-panel.mjs';
import { initSwipeNavigation } from './mobile/swipe.mjs';
import { initEmsoTool } from './tools/emso.mjs';
import { initVatTool } from './tools/vat.mjs';
import { initJwtTool } from './tools/jwt.mjs';
import { initJsonTool } from './tools/json.mjs';
import { initQifTool } from './tools/qif.mjs';
import { initXmlTool } from './tools/xml.mjs';
import { initJwtGenerator } from './tools/jwt-generator.mjs';
import { initImageResizer } from './tools/image-resizer.mjs';
function init() {
    initOperations();
    initToolNavigation();
    initRouter();
    initCopyButtons();
    initEmsoTool();
    initVatTool();
    initJwtTool();
    initJsonTool();
    initQifTool();
    initXmlTool();
    initJwtGenerator();
    initImageResizer();
    initKeyboardShortcuts();
    initMobileInfoRail();
    initSwipeNavigation();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}
