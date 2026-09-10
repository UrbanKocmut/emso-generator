import { byId } from '../shared.mjs';
import { currentRoute, renderRoute, navigate, ROUTE_SEQUENCE } from '../router.mjs';
export function initSwipeNavigation() {
    const surface = byId("main-content");
    let gesture = null;
    let settleTimer = 0;
    let settleFrame = 0;

    function panelForRoute(route) {
        return surface.querySelector('[data-panel="' + route + '"]');
    }

    function matchingTouch(touches, identifier) {
        return Array.from(touches).find(function (touch) {
            return touch.identifier === identifier;
        });
    }

    function isSwipeViewport() {
        return window.innerWidth <= 860 || (
            window.innerWidth > window.innerHeight &&
            window.innerHeight <= 500
        );
    }

    function clearPanelState(panel) {
        if (!panel) {
            return;
        }
        panel.classList.remove("is-swipe-active", "is-swipe-target");
        panel.style.removeProperty("transform");
        panel.style.removeProperty("top");
        panel.removeAttribute("aria-hidden");
        panel.hidden = panel.dataset.panel !== currentRoute();
    }

    function scrollToTopInstantly() {
        const root = document.documentElement;
        root.classList.add("is-route-scroll-resetting");
        void root.offsetWidth;
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                root.classList.remove("is-route-scroll-resetting");
            });
        });
    }

    function resetGesture() {
        window.clearTimeout(settleTimer);
        window.cancelAnimationFrame(settleFrame);
        if (gesture) {
            clearPanelState(gesture.activePanel);
            clearPanelState(gesture.targetPanel);
        }
        surface.classList.remove("is-swiping", "is-swipe-settling");
        gesture = null;
    }

    function finishGesture(activeGesture) {
        if (gesture !== activeGesture) {
            return;
        }
        const destination = activeGesture.commit && currentRoute() === activeGesture.route
            ? activeGesture.targetRoute : "";
        resetGesture();
        if (destination) {
            navigate(destination);
            scrollToTopInstantly();
        }
    }

    function prepareTarget(direction) {
        if (!gesture || gesture.direction === direction) {
            return;
        }

        if (gesture.targetPanel) {
            clearPanelState(gesture.targetPanel);
            gesture.targetPanel.hidden = true;
        }

        gesture.direction = direction;
        gesture.targetPanel = null;
        gesture.targetRoute = "";

        const routeIndex = ROUTE_SEQUENCE.indexOf(gesture.route);
        const targetRoute = ROUTE_SEQUENCE[routeIndex + direction];
        if (!targetRoute) {
            return;
        }

        const targetPanel = panelForRoute(targetRoute);
        if (!targetPanel) {
            return;
        }

        targetPanel.hidden = false;
        targetPanel.classList.add("is-swipe-target");
        targetPanel.setAttribute("aria-hidden", "true");
        targetPanel.style.top = gesture.scrollY + "px";
        targetPanel.style.transform = "translate3d(" + (direction * gesture.width) + "px, 0, 0)";
        gesture.targetPanel = targetPanel;
        gesture.targetRoute = targetRoute;
    }

    function settleGesture(commit) {
        if (!gesture || !gesture.dragging) {
            resetGesture();
            return;
        }

        const activeGesture = gesture;
        const shouldCommit = Boolean(commit && activeGesture.targetPanel && activeGesture.targetRoute);
        activeGesture.settling = true;
        activeGesture.commit = shouldCommit;
        surface.classList.remove("is-swiping");
        surface.classList.add("is-swipe-settling");
        void surface.offsetWidth;

        settleFrame = window.requestAnimationFrame(function () {
            if (gesture !== activeGesture) {
                return;
            }
            activeGesture.activePanel.style.transform = shouldCommit
                ? "translate3d(" + (-activeGesture.direction * activeGesture.width) + "px, 0, 0)"
                : "translate3d(0, 0, 0)";
            if (activeGesture.targetPanel) {
                activeGesture.targetPanel.style.transform = shouldCommit
                    ? "translate3d(0, 0, 0)"
                    : "translate3d(" + (activeGesture.direction * activeGesture.width) + "px, 0, 0)";
            }
        });

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        settleTimer = window.setTimeout(function () {
            finishGesture(activeGesture);
        }, reducedMotion ? 20 : 285);
    }

    surface.addEventListener("touchstart", function (event) {
        // Complete the accepted navigation before interpreting a new touch.
        // Cancelling its timer here would send the user back to the old tool.
        if (gesture && gesture.settling) {
            finishGesture(gesture);
        } else {
            resetGesture();
        }
        if (!isSwipeViewport() || event.touches.length !== 1) {
            return;
        }

        const route = currentRoute();
        const activePanel = panelForRoute(route);
        if (!activePanel) {
            return;
        }

        const touch = event.touches[0];
        gesture = {
            identifier: touch.identifier,
            route,
            activePanel,
            targetPanel: null,
            targetRoute: "",
            direction: 0,
            dragging: false,
            x: touch.clientX,
            y: touch.clientY,
            lastX: touch.clientX,
            lastTime: event.timeStamp,
            velocity: 0,
            scrollY: window.scrollY,
            width: Math.max(1, surface.clientWidth)
        };
    }, { passive: true });

    surface.addEventListener("touchmove", function (event) {
        if (!gesture || gesture.settling) {
            return;
        }

        const touch = matchingTouch(event.touches, gesture.identifier);
        if (!touch) {
            return;
        }

        const horizontalDistance = touch.clientX - gesture.x;
        const verticalDistance = touch.clientY - gesture.y;
        if (!gesture.dragging) {
            if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 9) {
                return;
            }
            if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * 1.08) {
                gesture = null;
                return;
            }
            gesture.dragging = true;
            gesture.activePanel.classList.add("is-swipe-active");
            surface.classList.add("is-swiping");
        }

        event.preventDefault();
        const direction = horizontalDistance < 0 ? 1 : -1;
        prepareTarget(direction);

        const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
        gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
        gesture.lastX = touch.clientX;
        gesture.lastTime = event.timeStamp;

        let translated = Math.max(-gesture.width, Math.min(gesture.width, horizontalDistance));
        if (!gesture.targetPanel) {
            translated *= .18;
        }
        gesture.activePanel.style.transform = "translate3d(" + translated + "px, 0, 0)";
        if (gesture.targetPanel) {
            gesture.targetPanel.style.transform = "translate3d(" +
                (translated + gesture.direction * gesture.width) + "px, 0, 0)";
        }
    }, { passive: false });

    surface.addEventListener("touchend", function (event) {
        if (!gesture || gesture.settling) {
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
        const horizontalDistance = touch.clientX - gesture.x;
        const minimumDistance = Math.min(110, Math.max(58, gesture.width * .18));
        const fastSwipe = Math.abs(gesture.velocity) > .42 && Math.abs(horizontalDistance) > 28;
        settleGesture(
            Boolean(gesture.targetPanel) &&
            (Math.abs(horizontalDistance) >= minimumDistance || fastSwipe)
        );
    }, { passive: false });

    surface.addEventListener("touchcancel", function () {
        if (gesture && gesture.settling) {
            return;
        }
        if (gesture && gesture.dragging) {
            settleGesture(false);
        } else {
            resetGesture();
        }
    }, { passive: true });

    window.addEventListener("delavnica:routechange", function () {
        if (gesture && gesture.route !== currentRoute()) {
            resetGesture();
        }
    });
    window.addEventListener("resize", function () {
        if (gesture && gesture.settling) {
            finishGesture(gesture);
        } else {
            resetGesture();
        }
    });
}
