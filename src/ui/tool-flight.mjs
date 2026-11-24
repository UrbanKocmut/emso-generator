// Move a visual copy after navigation. The real links, artwork and controls stay in place.
function visibleSquare(image) {
    if (!image) return null;
    const box = image.getBoundingClientRect();
    const size = Math.min(box.width, box.height);
    if (size < 1 || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) return null;
    return { x: box.x + (box.width - size) / 2, y: box.y + (box.height - size) / 2, size };
}

export function initToolFlights() {
    if (!Element.prototype.animate) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let candidate;
    let frame;
    let active;

    function enabled() {
        return !reduced.matches && document.documentElement.dataset.motion !== 'paused' && !document.hidden;
    }
    function clearFlight() {
        cancelAnimationFrame(frame);
        if (!active) return;
        active.animation.cancel();
        active.copy.remove();
        active = null;
    }

    document.addEventListener('click', event => {
        candidate = null;
        if (!enabled() || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[data-route]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const panel = document.querySelector('[data-panel]:not([hidden])');
        const destination = link.dataset.route;
        if (!panel || panel.dataset.panel === destination) return;

        const returning = destination === 'overview';
        const source = returning ? panel.querySelector('.tool-art') : link.querySelector('.card-art, .nav-art');
        const from = visibleSquare(source);
        if (!from) return;
        const captured = { from, src: source.currentSrc || source.src, destination, previous: panel.dataset.panel };
        candidate = captured;
        // A modified or cancelled navigation must never arm the next route change.
        setTimeout(() => { if (candidate === captured) candidate = null; }, 0);
    }, true);

    function fly({ from, src, destination, previous }) {
        if (!enabled()) return;
        const to = destination === 'overview'
            ? visibleSquare(document.querySelector(`.tool-card[data-route="${previous}"] .card-art`))
            : visibleSquare(document.querySelector(`[data-panel="${destination}"] .tool-art`)) ||
              visibleSquare(document.querySelector(`.tool-nav-link[data-route="${destination}"] .nav-art`));
        if (!to) return;
        const x = to.x - from.x;
        const y = to.y - from.y;
        const distance = Math.hypot(x, y);
        if (distance < 16) return;

        const copy = new Image();
        copy.className = 'motion-flight';
        copy.alt = '';
        copy.setAttribute('aria-hidden', 'true');
        copy.src = src;
        Object.assign(copy.style, { left: from.x + 'px', top: from.y + 'px', width: from.size + 'px', height: from.size + 'px' });
        document.body.append(copy);
        const scale = to.size / from.size;
        const lift = Math.min(90, distance * .28);
        const turn = x < 0 ? -19 : 19;
        const animation = copy.animate([
            { transform: 'translate(0, 0) scale(1)' },
            { offset: .52, transform: `translate(${x * .55}px, ${y * .55 - lift}px) rotate(${turn}deg) scale(${(1 + scale) * .58})` },
            { offset: .85, opacity: 1, transform: `translate(${x}px, ${y - 4}px) rotate(-3deg) scale(${scale * 1.06})` },
            { opacity: 0, transform: `translate(${x}px, ${y}px) scale(${scale})` }
        ], { duration: Math.min(650, 390 + distance / 4), easing: 'cubic-bezier(.2,.68,.23,1)', fill: 'both' });
        active = { copy, animation };
        animation.onfinish = () => { if (active?.copy === copy) clearFlight(); };
    }

    window.addEventListener('delavnica:routechange', event => {
        clearFlight();
        const captured = candidate;
        candidate = null;
        if (captured?.destination === event.detail.route) frame = requestAnimationFrame(() => fly(captured));
    });
    // Scroll coordinates from the router have settled by the first frame.
    document.addEventListener('scroll', () => { if (active) clearFlight(); }, { capture: true, passive: true });
    window.addEventListener('resize', clearFlight);
    window.addEventListener('pagehide', clearFlight);
    window.addEventListener('delavnica:motionchange', clearFlight);
    document.addEventListener('visibilitychange', clearFlight);
}
