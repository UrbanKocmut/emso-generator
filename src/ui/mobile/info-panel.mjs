import { byId } from '../shared.mjs';
import { currentRoute, renderRoute, navigate, ROUTE_SEQUENCE } from '../router.mjs';
export function initMobileInfoRail() {
    const hint = byId("mobile-info-hint");
    const rail = byId("mobile-info-rail");
    const closeButton = byId("mobile-info-close");
    const surface = byId("main-content");
    const homeLink = document.querySelector(".mobile-home-link");
    const sidebar = document.querySelector(".sidebar");
    const overviewPanel = document.querySelector('[data-panel="overview"]');
    if (!hint || !rail || !closeButton || !surface || !homeLink || !sidebar || !overviewPanel) {
        return;
    }

    let isOpen = false;
    let gesture = null;
    let settleTimer = 0;
    let settleFrame = 0;

    function isMobileInfoViewport() {
        return window.innerWidth <= 640 && window.innerWidth <= window.innerHeight;
    }

    function syncInfoGeometry() {
        if (isMobileInfoViewport()) {
            // Use the actual grid cell, including its fractional width, so
            // scrollbars and safe-area padding cannot offset the rail edge.
            document.body.style.setProperty("--mobile-info-width",
                homeLink.getBoundingClientRect().width + "px");
            document.body.style.setProperty("--mobile-nav-height",
                sidebar.getBoundingClientRect().height + "px");
        } else {
            document.body.style.removeProperty("--mobile-info-width");
            document.body.style.removeProperty("--mobile-nav-height");
        }
    }

    function matchingTouch(touches, identifier) {
        return Array.from(touches).find(function (touch) {
            return touch.identifier === identifier;
        });
    }

    function setOpen(nextOpen, focusTarget, forceAnimation) {
        const resolvedOpen = Boolean(
            nextOpen && isMobileInfoViewport() && currentRoute() === "overview"
        );
        const shouldAnimate = isMobileInfoViewport() && currentRoute() === "overview" &&
            Boolean(forceAnimation || resolvedOpen !== isOpen);
        window.clearTimeout(settleTimer);
        window.cancelAnimationFrame(settleFrame);
        gesture = null;
        if (shouldAnimate) {
            document.body.classList.add("is-mobile-info-settling");
        }
        isOpen = resolvedOpen;
        document.body.classList.toggle("is-mobile-info-open", isOpen);
        document.body.classList.remove("is-mobile-info-dragging");
        rail.setAttribute("aria-hidden", String(!isOpen));
        rail.inert = !isOpen;
        hint.setAttribute("aria-expanded", String(isOpen));
        if (shouldAnimate) {
            settleFrame = window.requestAnimationFrame(function () {
                rail.style.removeProperty("transform");
                overviewPanel.style.removeProperty("transform");
            });
            settleTimer = window.setTimeout(function () {
                document.body.classList.remove("is-mobile-info-settling");
            }, 260);
        } else {
            rail.style.removeProperty("transform");
            overviewPanel.style.removeProperty("transform");
            document.body.classList.remove("is-mobile-info-settling");
        }
        if (focusTarget) {
            (isOpen ? closeButton : surface).focus({ preventScroll: true });
        }
    }

    function resetGesture() {
        document.body.classList.remove("is-mobile-info-dragging");
        rail.style.removeProperty("transform");
        overviewPanel.style.removeProperty("transform");
        rail.setAttribute("aria-hidden", String(!isOpen));
        rail.inert = !isOpen;
        gesture = null;
    }

    function startGesture(event, fromRail) {
        if (
            !isMobileInfoViewport() ||
            currentRoute() !== "overview" ||
            event.touches.length !== 1 ||
            surface.classList.contains("is-swipe-settling")
        ) {
            return;
        }

        const touch = event.touches[0];
        window.clearTimeout(settleTimer);
        window.cancelAnimationFrame(settleFrame);
        document.body.classList.remove("is-mobile-info-settling");
        if (fromRail || isOpen) {
            event.stopPropagation();
        }

        gesture = {
            identifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastTime: event.timeStamp,
            velocity: 0,
            dragging: false,
            startedOpen: isOpen,
            width: Math.max(1, rail.getBoundingClientRect().width || surface.clientWidth / ROUTE_SEQUENCE.length)
        };
    }

    function moveGesture(event) {
        if (!gesture) {
            return;
        }
        const touch = matchingTouch(event.touches, gesture.identifier);
        if (!touch) {
            return;
        }

        const horizontalDistance = touch.clientX - gesture.startX;
        const verticalDistance = touch.clientY - gesture.startY;
        if (!gesture.dragging) {
            if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 8) {
                return;
            }
            if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * 1.08) {
                resetGesture();
                return;
            }
            if (!gesture.startedOpen && horizontalDistance < 0) {
                gesture = null;
                return;
            }
            gesture.dragging = true;
            document.body.classList.add("is-mobile-info-dragging");
            rail.setAttribute("aria-hidden", "false");
        }

        event.preventDefault();
        event.stopPropagation();
        const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
        gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
        gesture.lastX = touch.clientX;
        gesture.lastTime = event.timeStamp;

        const initial = gesture.startedOpen ? gesture.width : 0;
        const progress = Math.max(0, Math.min(gesture.width, initial + horizontalDistance));
        rail.style.transform = "translate3d(" + (progress - gesture.width) + "px, 0, 0)";
        overviewPanel.style.transform = "translate3d(" + progress + "px, 0, 0)";
    }

    function endGesture(event) {
        if (!gesture) {
            return;
        }
        const touch = matchingTouch(event.changedTouches, gesture.identifier);
        if (!touch) {
            return;
        }

        if (!gesture.dragging) {
            resetGesture();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const horizontalDistance = touch.clientX - gesture.startX;
        const threshold = Math.min(46, gesture.width * .5);
        const fastOpening = gesture.velocity > .35 && horizontalDistance > 18;
        const fastClosing = gesture.velocity < -.35 && horizontalDistance < -18;
        const nextOpen = gesture.startedOpen
            ? !(horizontalDistance <= -threshold || fastClosing)
            : horizontalDistance >= threshold || fastOpening;

        gesture = null;
        setOpen(nextOpen, false, true);
    }

    hint.addEventListener("click", function () {
        setOpen(true, true);
    });
    closeButton.addEventListener("click", function () {
        setOpen(false, true);
    });
    rail.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
            setOpen(false, false);
        }
    });
    [overviewPanel, hint].forEach(function (target) {
        target.addEventListener("touchstart", function (event) {
            startGesture(event, false);
        }, { passive: true });
    });
    rail.addEventListener("touchstart", function (event) {
        startGesture(event, true);
    }, { passive: true });
    [overviewPanel, rail, hint].forEach(function (target) {
        target.addEventListener("touchmove", moveGesture, { passive: false });
        target.addEventListener("touchend", endGesture, { passive: false });
        target.addEventListener("touchcancel", function () {
            if (gesture && gesture.dragging) {
                gesture = null;
                setOpen(isOpen, false, true);
            } else {
                resetGesture();
            }
        }, { passive: true });
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isOpen) {
            setOpen(false, true);
        }
    });
    window.addEventListener("delavnica:routechange", function () {
        if (currentRoute() !== "overview" &&
            (isOpen || gesture || document.body.classList.contains("is-mobile-info-settling"))) {
            setOpen(false, false);
        }
    });
    window.addEventListener("resize", function () {
        syncInfoGeometry();
        if (!isMobileInfoViewport()) {
            setOpen(false, false);
        }
    });
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            setOpen(false, false);
        }
    });
    const layoutObserver = new ResizeObserver(syncInfoGeometry);
    layoutObserver.observe(homeLink);
    layoutObserver.observe(sidebar);
    syncInfoGeometry();
    setOpen(false, false);
}
