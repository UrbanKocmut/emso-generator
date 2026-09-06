"use strict";

// Minimal DOM surface for controller tests; layout is tested in the browser suite.
class Element {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.listeners = new Map();
        this.className = "";
        this.value = "";
        this.hidden = false;
        this.isConnected = true;
        this.classList = {
            contains: (name) => this.className.split(" ").includes(name),
            add: (...names) => { this.className = [...new Set([...this.className.split(" "), ...names])].join(" "); },
            remove: (...names) => { this.className = this.className.split(" ").filter((name) => !names.includes(name)).join(" "); },
            toggle: (name, enabled) => { this.classList[enabled ? "add" : "remove"](name); }
        };
    }
    append(...children) { children.forEach((child) => this.appendChild(child)); }
    appendChild(child) {
        if (child.parent) child.remove();
        child.parent = this;
        child.isConnected = true;
        this.children.push(child);
        return child;
    }
    remove() {
        if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
        this.isConnected = false;
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }
    dispatch(type, event = {}) {
        this.listeners.get(type)?.forEach((listener) => listener({ target: this, ...event }));
    }
    matches(selector) {
        const data = /^(?:button)?\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
        if (data) {
            const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            return (!selector.startsWith("button") || this.tagName === "button")
                && (data[2] === undefined ? key in this.dataset : this.dataset[key] === data[2]);
        }
        return selector.startsWith(".") ? this.classList.contains(selector.slice(1)) : this.tagName === selector;
    }
    querySelectorAll(selector) {
        return this.children.flatMap((child) => [
            ...(selector.split(", ").some((part) => child.matches(part)) ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
    focus() {}
}

module.exports = { Element };
