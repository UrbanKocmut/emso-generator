export function normalizeRotation(value) {
    const rotation = Number(value);
    if (!Number.isFinite(rotation)) {
        return 0;
    }
    const snapped = Math.round(rotation / 90) * 90;
    return ((snapped % 360) + 360) % 360;
}

export function movePage(pages, pageId, offset) {
    const list = Array.from(pages || []);
    const currentIndex = list.findIndex(function (page) {
        return page.id === pageId;
    });
    if (currentIndex === -1) {
        return list;
    }

    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + Number(offset || 0)));
    if (nextIndex === currentIndex) {
        return list;
    }

    const moved = list.splice(currentIndex, 1)[0];
    list.splice(nextIndex, 0, moved);
    return list;
}

export function reorderPage(pages, pageId, targetId, placeAfter) {
    const list = Array.from(pages || []);
    const sourceIndex = list.findIndex(function (page) {
        return page.id === pageId;
    });
    const targetIndex = list.findIndex(function (page) {
        return page.id === targetId;
    });
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return list;
    }

    const moved = list.splice(sourceIndex, 1)[0];
    const adjustedTargetIndex = list.findIndex(function (page) {
        return page.id === targetId;
    });
    list.splice(adjustedTargetIndex + (placeAfter ? 1 : 0), 0, moved);
    return list;
}
