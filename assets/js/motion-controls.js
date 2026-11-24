// The launcher, privacy page and guide share this control, including in file mode.
(() => {
    const header = document.querySelector('.masthead');
    if (!header) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const english = document.documentElement.lang === 'en';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'motion-switch';
    button.setAttribute('aria-label', english ? 'Pause animations' : 'Premor animacij');
    button.innerHTML = '<span class="marble-lane" aria-hidden="true"><i></i><i></i><i></i></span><span class="motion-glyph" aria-hidden="true"></span>';
    header.insertBefore(button, header.querySelector('.masthead-meta'));

    function sync() {
        const paused = document.documentElement.dataset.motion === 'paused';
        button.hidden = reduced.matches;
        button.setAttribute('aria-pressed', String(paused));
        button.title = paused
            ? (english ? 'Resume animations' : 'Nadaljuj animacije')
            : (english ? 'Pause animations' : 'Ustavi animacije');
        window.dispatchEvent(new CustomEvent('delavnica:motionchange', {
            detail: { enabled: !paused && !reduced.matches }
        }));
    }
    button.addEventListener('click', () => {
        const { dataset } = document.documentElement;
        if (dataset.motion === 'paused') delete dataset.motion;
        else dataset.motion = 'paused';
        sync();
    });
    reduced.addEventListener('change', sync);
    sync();
})();
