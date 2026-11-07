import { useEffect } from 'react';

// The on-screen keyboard (phones): on iOS, and on Android's Chrome since 108, it covers the page
// instead of making it smaller, so whatever is fixed to the bottom edge (a sheet like the add form)
// sits behind it. Its height is the part of the window the visible area no longer reaches; it is
// kept in --keyboard-inset on <html> (0px without a keyboard) for the sheets to stand on
// (index.css, "Sheets").
export function keyboardInset(win = window) {
    const viewport = win.visualViewport;
    if (!viewport) return 0;
    const inset = win.innerHeight - (viewport.height + viewport.offsetTop);
    // pinch-zoom and the browser's own bars move it by a few pixels: not a keyboard
    return inset > 80 ? Math.round(inset) : 0;
}

export function useKeyboardInset() {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return undefined;
        const root = document.documentElement;
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const inset = keyboardInset();
                root.style.setProperty('--keyboard-inset', `${inset}px`);
                if (inset) root.setAttribute('data-keyboard', '');
                else root.removeAttribute('data-keyboard');
            });
        };
        update();
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        return () => {
            cancelAnimationFrame(frame);
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
            root.style.removeProperty('--keyboard-inset');
            root.removeAttribute('data-keyboard');
        };
    }, []);
}
