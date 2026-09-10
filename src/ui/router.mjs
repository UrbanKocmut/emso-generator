import { byId } from './shared.mjs';
import { structuredData } from '../metadata.mjs';
const tools = window.ToolboxTools;
const TOOL_ROUTES = tools.map(function (tool) { return tool.id; });
export const ROUTE_SEQUENCE = ["overview"].concat(TOOL_ROUTES);
const ROUTES = new Set(ROUTE_SEQUENCE);
const ROUTE_TITLES = Object.fromEntries(tools.map(function (tool) {
    return [tool.id, tool.pageTitle];
}));
ROUTE_TITLES.overview = tools.overview.pageTitle;
let renderedRoute = "";
const root = new URL(window.DelavnicaRoot);
const fileMode = window.location.protocol === "file:";
const pages = [tools.overview, ...tools];
export function currentRoute() {
    const hash = window.location.hash.slice(1).toLowerCase();
    if (ROUTES.has(hash)) return hash;
    const relative = window.location.pathname.slice(root.pathname.length).replace(/index\.html$/, "");
    return pages.find(page => page.path === relative)?.id || "overview";
}
export function routeUrl(route) {
    return fileMode ? new URL("index.html#" + route, root).href : new URL(pages.find(page => page.id === route).path, root).href;
}
export function navigate(route, { replace = false, resetScroll = true } = {}) {
    if (!ROUTES.has(route)) throw new Error("Unknown tool route.");
    const url = routeUrl(route);
    if (window.location.href !== url) window.history[replace ? "replaceState" : "pushState"](null, "", url);
    renderRoute();
    if (resetScroll) {
        document.documentElement.classList.add("is-route-scroll-resetting");
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        requestAnimationFrame(() => document.documentElement.classList.remove("is-route-scroll-resetting"));
    }
}
export function initToolNavigation() {
    document.documentElement.style.setProperty("--tool-route-count", String(ROUTE_SEQUENCE.length));
    document.querySelectorAll("[data-route]").forEach(link => { link.href = routeUrl(link.dataset.route); });
}

export function renderRoute() {
    const route = currentRoute();
    let activeLink = null;

    document.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.hidden = panel.dataset.panel !== route;
    });
    byId("mobile-info-hint").hidden = route !== "overview";

    document.querySelectorAll("[data-route]").forEach(function (link) {
        if (link.dataset.route === route) {
            link.setAttribute("aria-current", "page");
            if (link.classList.contains("tool-nav-link")) activeLink = link;
        } else {
            link.removeAttribute("aria-current");
        }
    });

    document.title = ROUTE_TITLES[route];
    if (route === "pdf") {
        window.DelavnicaPdfLoader.load();
    }

    const sidebar = document.querySelector(".sidebar");
    if (activeLink && sidebar && sidebar.scrollWidth > sidebar.clientWidth) {
        sidebar.scrollLeft = activeLink.offsetLeft - (sidebar.clientWidth - activeLink.offsetWidth) / 2;
    }
    const changed = renderedRoute !== route;
    renderedRoute = route;
    const metadata = pages.find(page => page.id === route);
    document.querySelector('meta[name="description"]').content = metadata.description;
    document.querySelector('link[rel="canonical"]').href = "https://delavnica.kocmut.com/" + metadata.path;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = metadata.description;
    document.querySelector('meta[property="og:url"]').content = "https://delavnica.kocmut.com/" + metadata.path;
    document.getElementById('app-structured-data').textContent = JSON.stringify(structuredData(metadata));
    if (changed) window.dispatchEvent(new CustomEvent("delavnica:routechange", { detail: { route } }));
}

export function initRouter() {
    function fromLocation() {
        const alias = window.location.hash.slice(1).toLowerCase();
        if (!fileMode && ROUTES.has(alias)) {
            navigate(alias, { replace: true, resetScroll: false });
        } else if (currentRoute() !== renderedRoute) renderRoute();
    }
    document.addEventListener("click", event => {
        const link = event.target.closest("a[data-route]");
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
        event.preventDefault();
        navigate(link.dataset.route);
    });
    window.addEventListener("popstate", fromLocation);
    window.addEventListener("hashchange", fromLocation);
    fromLocation();
}
