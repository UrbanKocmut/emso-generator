const bounce = [
    { scale: '.92 1.08', translate: '0 0', rotate: '-2deg' },
    { scale: '1.07 .9', translate: '0 5px', rotate: '3deg', offset: .22 },
    { scale: '.98 1.03', translate: '0 -6px', rotate: '-3deg', offset: .5 },
    { scale: '1.01 .99', translate: '0 1px', rotate: '1deg', offset: .75 },
    { scale: '1', translate: '0 0', rotate: '0deg' }
];
const readout = [
    { translate: '0 4px', backgroundColor: 'var(--pocket)' },
    { translate: '0 -2px', offset: .42 },
    { translate: '0 0' }
];
const shake = [
    { translate: '0 0' }, { translate: '4px 0' }, { translate: '-3px 0' },
    { translate: '2px 0' }, { translate: '0 0' }
];

export function initWorkspaceMotion() {
    if (!Element.prototype.animate) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map();
    let panel = null;
    let list = null;
    let itemCount = 0;
    let reorderFrame = 0;

    function enabled() {
        return !reduced.matches && !document.hidden && document.documentElement.dataset.motion !== 'paused';
    }

    function play(element, name, keyframes, duration, delay = 0) {
        if (!element || !enabled()) return;
        running.get(element)?.cancel();
        const animation = element.animate(keyframes, {
            id: 'igralnica-workspace-' + name, duration, delay, easing: 'cubic-bezier(.2,.68,.29,1)'
        });
        running.set(element, animation);
        const finish = () => {
            if (running.get(element) === animation) running.delete(element);
            if (element.classList.contains('workspace-sparks')) element.remove();
        };
        animation.onfinish = animation.oncancel = finish;
    }

    function result(event) {
        if (!enabled() || event.detail.tool !== panel?.dataset.panel) return;
        const success = event.detail.success;
        play(panel.querySelector('.tool-art'), success ? 'bounce' : 'wobble', success ? bounce : shake, 520);
        if (!success) return;
        // Only animate the small bezels. An editor can contain megabytes of local text.
        const labels = panel.querySelectorAll('.output-panel:has(.code-output, .code-block) > .panel-label');
        labels.forEach((label, index) => play(label, 'readout', readout, 620, index * 55));
        play(panel.querySelector('#image-resizer-downloads .artifact-link'), 'download', bounce, 450);
    }

    const statusObserver = new MutationObserver(() => {
        const status = panel?.querySelector('.inline-status');
        if (status?.classList.contains('is-error')) {
            play(status, 'error', shake, 320);
        } else if (list) {
            play(status, 'file-status', [{ translate: '0 3px' }, { translate: '0 0' }], 210);
        }
    });

    const collectionObserver = new MutationObserver(() => {
        if (!list) return;
        const count = list.children.length;
        if (count > itemCount) {
            // Batch imports share one arrival cue, regardless of the number of files or pages.
            play(list.children[itemCount], 'arrival', [
                { translate: '0 10px', scale: '.97' },
                { translate: '0 -2px', scale: '1', offset: .55 }, { translate: '0 0' }
            ], 420);
        }
        itemCount = count;
    });

    const toast = document.getElementById('toast');
    const toastObserver = new MutationObserver(() => {
        if (!toast.hidden) play(toast, 'toast', [
            { translate: '0 13px', scale: '.91' }, { translate: '0 -3px', scale: '1.025', offset: .5 },
            { translate: '0 0', scale: '1' }
        ], 420);
    });

    function reconnect() {
        statusObserver.disconnect();
        collectionObserver.disconnect();
        toastObserver.disconnect();
        cancelAnimationFrame(reorderFrame);
        running.forEach(animation => animation.cancel());
        running.clear();
        list = null;
        panel = document.querySelector('.tool-panel:not([hidden]):not(.overview-panel):not(.is-swipe-target)');
        if (!enabled()) return;
        if (toast) toastObserver.observe(toast, { attributes: true, attributeFilter: ['data-toast-revision'] });
        if (!panel) return;
        const status = panel.querySelector('.inline-status');
        if (status) statusObserver.observe(status, { childList: true });
        list = panel.querySelector('.pdf-page-grid, .image-list');
        if (list) {
            itemCount = list.children.length;
            collectionObserver.observe(list, { childList: true });
        }
    }

    function press(event) {
        if (!enabled() || !panel?.contains(event.target)) return;
        const control = event.target.closest('.button, .mini-button, .pdf-page-action, .artifact-link');
        if (!control) return;
        play(control, 'press', [
            { scale: '.945 .91' }, { scale: '1.025 1.055', offset: .43 }, { scale: '1' }
        ], 325);
        if (!control.classList.contains('primary')) return;
        control.querySelector('.workspace-sparks')?.remove();
        const sparks = document.createElement('span');
        sparks.className = 'workspace-sparks';
        sparks.setAttribute('aria-hidden', 'true');
        control.append(sparks);
        play(sparks, 'sparks', [
            { scale: '.35 .15', opacity: .7 }, { scale: '.9 1', opacity: 1, offset: .35 },
            { scale: '1.04 1.25', opacity: 0 }
        ], 410);
    }

    // Capture only the interacting cards before the existing controller updates their positions.
    function movePage(event) {
        if (!enabled() || list?.id !== 'pdf-pages' || !list.contains(event.target) || list.classList.contains('is-busy')) return;
        const target = event.target.closest('.pdf-page-card');
        if (!target) return;
        const action = event.target.closest('[data-action]')?.dataset.action;
        let other;
        if (event.type === 'drop') {
            other = list.querySelector('.is-dragging');
            if (!other || other === target) return;
        } else if (event.type === 'keydown') {
            if (!event.altKey || event.target.closest('button') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            other = event.key === 'ArrowLeft' ? target.previousElementSibling : target.nextElementSibling;
        } else if (action === 'previous' || action === 'next') {
            other = action === 'previous' ? target.previousElementSibling : target.nextElementSibling;
        } else {
            if (action === 'rotate-left' || action === 'rotate-right') {
                play(target.querySelector('.pdf-page-preview'), 'turn', [
                    { rotate: action === 'rotate-left' ? '8deg' : '-8deg', scale: '.92' },
                    { rotate: '0deg', scale: '1' }
                ], 360);
            }
            return;
        }
        if (!other) return;
        const before = [target, other].map(card => ({ card, x: card.offsetLeft, y: card.offsetTop }));
        cancelAnimationFrame(reorderFrame);
        reorderFrame = requestAnimationFrame(() => {
            for (const { card, x, y } of before) {
                const dx = x - card.offsetLeft, dy = y - card.offsetTop;
                if (dx || dy) play(card, 'reorder', [
                    { translate: Math.max(-120, Math.min(120, dx)) + 'px ' + Math.max(-120, Math.min(120, dy)) + 'px', scale: '.97' },
                    { translate: '0 0', scale: '1' }
                ], 340);
            }
        });
    }

    const pages = document.getElementById('pdf-pages');
    for (const type of ['click', 'keydown', 'drop']) pages?.addEventListener(type, movePage, true);
    document.getElementById('main-content')?.addEventListener('click', press, true);
    window.addEventListener('delavnica:toolresult', result);
    window.addEventListener('delavnica:routechange', reconnect);
    window.addEventListener('delavnica:motionchange', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    reduced.addEventListener('change', reconnect);
    reconnect();
}
