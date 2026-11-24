export function initLauncherMotion() {
    const tray = document.querySelector('.overview-grid');
    if (!tray) return;

    const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const variables = ['--toy-tilt-x', '--toy-tilt-y', '--toy-light-x', '--toy-light-y'];
    let tile = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    if ('IntersectionObserver' in window) {
        const visibility = new IntersectionObserver(entries => {
            for (const entry of entries) {
                entry.target.classList.toggle('toy-out-of-view', !entry.isIntersecting);
            }
        }, { rootMargin: '24px' });
        for (const card of tray.querySelectorAll('.tool-card')) visibility.observe(card);
    }

    function resetTilt() {
        cancelAnimationFrame(frame);
        frame = 0;
        if (tile) {
            for (const name of variables) tile.style.removeProperty(name);
            tile = null;
        }
    }

    function updateTilt() {
        frame = 0;
        const box = tile.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const across = Math.max(0, Math.min(1, (x - box.left) / box.width));
        const down = Math.max(0, Math.min(1, (y - box.top) / box.height));
        tile.style.setProperty('--toy-tilt-x', (7 - 14 * down).toFixed(2) + 'deg');
        tile.style.setProperty('--toy-tilt-y', (16 * across - 8).toFixed(2) + 'deg');
        tile.style.setProperty('--toy-light-x', (100 * across).toFixed(1) + '%');
        tile.style.setProperty('--toy-light-y', (100 * down).toFixed(1) + '%');
    }

    tray.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || !finePointer.matches || document.documentElement.dataset.motion === 'paused') return;
        const nextTile = event.target.closest('.tool-card');
        if (nextTile !== tile) {
            resetTilt();
            tile = nextTile;
        }
        if (!tile) return;
        x = event.clientX;
        y = event.clientY;
        if (!frame) frame = requestAnimationFrame(updateTilt);
    }, { passive: true });

    tray.addEventListener('pointerleave', resetTilt);
    tray.addEventListener('pointercancel', resetTilt);
    finePointer.addEventListener('change', resetTilt);
    document.addEventListener('visibilitychange', resetTilt);
    window.addEventListener('blur', resetTilt);
    window.addEventListener('delavnica:motionchange', resetTilt);
    window.addEventListener('delavnica:routechange', resetTilt);
}
