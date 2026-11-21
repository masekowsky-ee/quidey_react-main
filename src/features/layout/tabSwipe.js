import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { COMMUNITY_PATHS, isCommunityPath } from '../community/paths';
import { openMenu } from '../settings/settingsAction';
import { animate } from 'motion';
import { spring } from '../settings/motion';
import { PHONE_QUERY } from './breakpoints';
import { project, rubberband, velocityOf } from './dragDismiss';

// Phones: a sideways swipe across the page goes to the tab beside it, in the tab bar's order.
// Finger to the left: the next tab (Kalender → Fokus); to the right: the one before (Kalender →
// Start). Past the last tab (Lernen, or Sozial for those without the study plan) the menu comes in
// from the right, before the first (Start) from the left, where it always comes from.
// The page follows the finger 1:1 (and resists where there is no tab beside it: there the menu is
// what comes); let go, it goes where the flick was heading, carrying the finger's speed into the
// spring, and the next one slides in from the other side (App.jsx, pageSwipeMotion); otherwise it
// springs back. Grabbed again while it moves, it is taken from where it is. A touch that starts
// at the very edge of the screen is the system's back gesture, not ours. On "minimal" motion
// nothing moves, the pages only cross-fade.
// study: the fourth tab is Lernen (the study plan, testers for now) instead of Sozial; Sozial then
// lives behind "Mehr".
export const tabPaths = (study = false) => ['/', '/calendar', '/focus', study ? '/study' : COMMUNITY_PATHS.feed];
export const TAB_PATHS = tabPaths(false);

const isStudyPath = (pathname) => pathname === '/study' || pathname.startsWith('/study/');

export function tabIndexOf(pathname, study = false) {
    if (pathname === '/') return 0;
    if (pathname === '/calendar' || pathname.startsWith('/calendar/')) return 1;
    if (pathname === '/focus' || pathname.startsWith('/focus/')) return 2;
    if (study ? isStudyPath(pathname) : isCommunityPath(pathname)) return 3;
    return -1;
}

// a swipe: the page's projected resting place is past this share of the screen's width, or it was
// pulled this far (px); and clearly more sideways than up or down
const SHARE = 0.3;
const DISTANCE = 80;
const SIDEWAYS = 2;
// the page moves with the finger only once it is clearly a sideways move
const SLOP = 12;
// the system's gesture zone along both edges of the screen (px)
const EDGE = 20;

// What a sideways swipe there is meant for, and not for the tabs: typing, a slider, something
// that scrolls sideways (the week strip, a row of cards), something with a gesture of its own
// (touch-action: drags, the task card, the tutorial's pages, toasts), and the tab bar itself.
function ownsSwipe(target) {
    for (let el = target; el && el !== document.body; el = el.parentElement) {
        if (el.matches?.('input, textarea, select, [contenteditable="true"], [role="slider"], [data-part="tabbar"], [data-no-tab-swipe]')) return true;
        const style = getComputedStyle(el);
        if (style.touchAction !== 'auto' && style.touchAction !== 'manipulation') return true;
        if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(style.overflowX)) return true;
    }
    return false;
}

// something open over the page: the menu, a sheet, a dialog
const overlayOpen = () => Boolean(document.querySelector('[aria-modal="true"], [data-sheet-backdrop], [data-drawer-overlay]'));

// the current page's wrapper (App.jsx: the motion.div inside <main>)
const pageOf = () => document.querySelector('[data-part="main"] > *');
const moves = () => document.documentElement.getAttribute('data-motion') !== 'minimal';

// the page at dx px from its place; it fades a little as it leaves
function paint(page, dx) {
    page.style.transition = 'none';
    page.style.transform = dx === 0 ? '' : `translateX(${dx}px)`;
    page.style.opacity = dx === 0 ? '' : String(1 - Math.min(1, Math.abs(dx) / window.innerWidth) * 0.5);
}

export function useTabSwipe({ enabled = true } = {}) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const menuOpen = useSelector(state => state.settings.showMenu);
    // the tab bar's order: Lernen fourth (TabBar.jsx)
    const study = true;
    const current = useRef({ pathname, menuOpen, study });
    // the listeners below are set up once and read the latest of these
    useEffect(() => { current.current = { pathname, menuOpen, study }; }, [pathname, menuOpen, study]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || !window.matchMedia) return undefined;
        const phone = window.matchMedia(PHONE_QUERY);
        let gesture = null;
        // how far the page is from its place now (px), and the spring that is moving it (leaving or
        // coming back): a new touch takes the page from where it is
        let offset = 0;
        let spring$ = null;
        let shown = null;

        const show = (page, value) => { offset = value; paint(page, value); };
        const settle = (page, target, velocity, done) => {
            spring$?.stop();
            spring$ = animate(offset, target, {
                ...spring(target === 0 ? 0.35 : 0.28, 1),
                velocity,
                onUpdate: value => show(page, value),
                onComplete: () => { spring$ = null; done?.(); },
            });
        };

        const onStart = (e) => {
            gesture = null;
            if (!phone.matches || e.touches.length !== 1 || current.current.menuOpen || overlayOpen()) return;
            if (tabIndexOf(current.current.pathname, current.current.study) < 0 || ownsSwipe(e.target)) return;
            const touch = e.touches[0];
            // the screen's edges belong to the system's back gesture
            if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
            // caught mid-spring: carry on from where the page is
            if (spring$) { spring$.stop(); spring$ = null; }
            const caught = offset !== 0 && shown?.isConnected;
            gesture = { x: touch.clientX, y: touch.clientY, t: e.timeStamp, sideways: caught, page: caught ? shown : null, base: caught ? offset : 0, samples: [] };
        };

        const onMove = (e) => {
            if (!gesture) return;
            const touch = e.touches[0];
            let dx = touch.clientX - gesture.x;
            const dy = touch.clientY - gesture.y;
            if (!gesture.sideways) {
                // scrolling up or down: not a swipe
                if (Math.abs(dy) > SLOP && Math.abs(dy) * SIDEWAYS > Math.abs(dx)) { gesture = null; return; }
                if (Math.abs(dx) < SLOP) return;
                gesture.sideways = true;
                gesture.page = moves() ? pageOf() : null;
                shown = gesture.page;
                // it starts here without a jump: the slop is taken off
                gesture.x += Math.sign(dx) * SLOP;
                dx = touch.clientX - gesture.x;
            }
            const raw = gesture.base + dx;
            gesture.raw = raw;
            gesture.samples.push({ at: raw, t: e.timeStamp });
            if (gesture.samples.length > 8) gesture.samples.shift();
            if (!gesture.page) return;
            // 1:1 where there is a tab beside it, a rubber band where the menu is what comes
            const target = tabIndexOf(current.current.pathname, current.current.study) + (raw < 0 ? 1 : -1);
            const free = target >= 0 && target < tabPaths(current.current.study).length;
            show(gesture.page, free ? raw : rubberband(raw, window.innerWidth));
        };

        const onEnd = (e) => {
            if (!gesture) return;
            const { page, sideways } = gesture;
            const touch = e.changedTouches[0];
            const raw = gesture.raw ?? gesture.base;
            const dy = touch.clientY - gesture.y;
            const velocity = e.type === 'touchcancel' ? 0 : velocityOf(gesture.samples, e.timeStamp) * 1000;
            gesture = null;
            if (!sideways) return;
            // where the flick is heading: the page's resting place if it were let go
            const heading = raw + project(velocity);
            const swiped = raw !== 0 && Math.sign(heading) === Math.sign(raw)
                && Math.abs(dy) * SIDEWAYS <= Math.abs(raw)
                && (Math.abs(heading) >= SHARE * window.innerWidth || Math.abs(raw) >= DISTANCE)
                // a word being selected is not a swipe
                && String(window.getSelection?.() ?? '').length === 0;
            if (!swiped) { if (page) settle(page, 0, velocity); return; }

            const step = raw < 0 ? 1 : -1;
            const paths = tabPaths(current.current.study);
            const next = tabIndexOf(current.current.pathname, current.current.study) + step;
            if (next < 0 || next >= paths.length) {
                if (page) settle(page, 0, velocity);
                dispatch(openMenu(next < 0 ? 'left' : 'right'));
                return;
            }
            const go = () => { offset = 0; shown = null; navigate(paths[next], { state: { tabSwipe: step } }); };
            if (!page) { go(); return; }
            // the old page goes on the way the finger threw it, then the new one comes in
            settle(page, -step * window.innerWidth * 0.6, velocity, go);
        };

        // the system took the touch away: the page goes back
        const onCancel = () => {
            if (gesture?.page) settle(gesture.page, 0, 0);
            gesture = null;
        };

        document.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd, { passive: true });
        document.addEventListener('touchcancel', onCancel, { passive: true });
        return () => {
            spring$?.stop();
            document.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('touchcancel', onCancel);
        };
    }, [enabled, navigate, dispatch]);
}
