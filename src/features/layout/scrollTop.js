// A tap on the nav entry of the page you are already on brings you back to the top of it
// (also from a page below it: /study/5 on "Lernen"). Other taps leave the scroll alone.
export function isOnPlace(pathname, to, match) {
    if (match) return Boolean(match(pathname));
    if (to === '/') return pathname === '/';
    return pathname === to || pathname.startsWith(`${to}/`);
}

export function scrollToTop() {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    window.scrollTo?.({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

// onClick for a nav link; `then` runs after (closing the drawer)
export function topOnSamePlace(pathname, to, match, then) {
    return (event) => {
        if (isOnPlace(pathname, to, match)) scrollToTop();
        then?.(event);
    };
}
