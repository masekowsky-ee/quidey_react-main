import { useEffect } from 'react';

// The chosen option of a group of options (a segmented control, the page tabs, the menu's
// entries) is marked by one highlight that slides from option to option, the way the tab bar's
// mark does, instead of the colour jumping.
//
// Which groups: the option marked by a "segmentActive" class (ui.module.css, composed by every
// segmented control and tab bar), and the current entry in a menu list ([data-slide-container]
// > [data-active]). The group's stylesheet draws the highlight on its ::before from the custom
// properties set here on the group (--seg-x, --seg-y, --seg-w, --seg-h, --seg-r) and
// data-slide: "init" while it is first put in place (no travel), "on" afterwards.
const ACTIVE = '[class*="segmentActive"], [data-slide-container] > [data-active]';

function place(active) {
    const group = active.parentElement;
    if (!group) return;
    // not on screen (hidden entry, closed panel): no mark, it is placed afresh when it shows
    if (active.offsetWidth === 0 || active.offsetHeight === 0) { delete group.dataset.slide; return; }
    const values = {
        '--seg-x': `${active.offsetLeft}px`,
        '--seg-y': `${active.offsetTop}px`,
        '--seg-w': `${active.offsetWidth}px`,
        '--seg-h': `${active.offsetHeight}px`,
        '--seg-r': getComputedStyle(active).borderTopLeftRadius,
    };
    for (const [name, value] of Object.entries(values)) {
        if (group.style.getPropertyValue(name) !== value) group.style.setProperty(name, value);
    }
    if (!group.dataset.slide) {
        // first time: in place at once; the travel starts with the next change
        group.dataset.slide = 'init';
        requestAnimationFrame(() => requestAnimationFrame(() => { if (group.dataset.slide === 'init') group.dataset.slide = 'on'; }));
    }
}

export function useSlidingActive() {
    useEffect(() => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
        let frame = 0;
        const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule());
        const watched = new WeakSet();
        function measure() {
            frame = 0;
            for (const active of document.querySelectorAll(ACTIVE)) {
                place(active);
                const group = active.parentElement;
                if (group && resizes && !watched.has(group)) { watched.add(group); resizes.observe(group); }
            }
        }
        function schedule() {
            if (!frame) frame = requestAnimationFrame(measure);
        }
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-active', 'aria-pressed'] });
        window.addEventListener('resize', schedule);
        schedule();
        return () => {
            observer.disconnect();
            resizes?.disconnect();
            window.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);
}
