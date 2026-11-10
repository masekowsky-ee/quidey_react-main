import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { COMMUNITY_PATHS, isCommunityPath } from '../community/paths';
import { openMenu } from '../settings/settingsAction';
import { PHONE_QUERY } from './breakpoints';

// Phones: a sideways swipe across the page goes to the tab beside it, in the tab bar's order.
// Finger to the left: the next tab (Kalender → Fokus); to the right: the one before (Kalender →
// Start). Past the last tab (Lernen, or Sozial for those without the study plan) the menu comes in
// from the right, before the first (Start) from the left, where it always comes from.
// The page follows the finger a little while it moves; let go far enough, it slides out that way
// and the next one slides in from the other side (App.jsx, pageSwipeMotion), otherwise it springs
// back. On "minimal" motion nothing moves, the pages only cross-fade.
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

// a swipe: this far (px), or a flick this fast (px/ms) over at least FLICK_MIN; and clearly more
// sideways than up or down
const DISTANCE = 80;
const FLICK = 0.5;
const FLICK_MIN = 40;
const SIDEWAYS = 2;
// the page moves with the finger only once it is clearly a sideways move
const SLOP = 12;
// how much of the finger's way the page follows
const FOLLOW = 0.45;
// the old page's way out before the new one comes in
const OUT_MS = 130;

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

function paint(page, dx) {
    page.style.transition = 'none';
    page.style.transform = `translateX(${dx * FOLLOW}px)`;
    page.style.opacity = String(1 - Math.min(1, Math.abs(dx) / window.innerWidth) * 0.4);
}

function springBack(page) {
    page.style.transition = 'transform 0.35s var(--spring-curve), opacity 0.2s ease-out';
    page.style.transform = '';
    page.style.opacity = '';
    page.addEventListener('transitionend', () => { page.style.transition = ''; }, { once: true });
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
        let leaving = 0;

        const onStart = (e) => {
            gesture = null;
            if (!phone.matches || e.touches.length !== 1 || current.current.menuOpen || overlayOpen()) return;
            if (tabIndexOf(current.current.pathname, current.current.study) < 0 || ownsSwipe(e.target)) return;
            const touch = e.touches[0];
            gesture = { x: touch.clientX, y: touch.clientY, t: e.timeStamp, sideways: false, page: null };
        };

        const onMove = (e) => {
            if (!gesture) return;
            const touch = e.touches[0];
            const dx = touch.clientX - gesture.x;
            const dy = touch.clientY - gesture.y;
            if (!gesture.sideways) {
                // scrolling up or down: not a swipe
                if (Math.abs(dy) > SLOP && Math.abs(dy) * SIDEWAYS > Math.abs(dx)) { gesture = null; return; }
                if (Math.abs(dx) < SLOP) return;
                gesture.sideways = true;
                gesture.page = moves() ? pageOf() : null;
            }
            if (gesture.page) paint(gesture.page, dx);
        };

        const onEnd = (e) => {
            if (!gesture) return;
            const { page } = gesture;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - gesture.x;
            const dy = touch.clientY - gesture.y;
            const speed = Math.abs(dx) / Math.max(1, e.timeStamp - gesture.t);
            gesture = null;
            const swiped = Math.abs(dx) >= Math.abs(dy) * SIDEWAYS
                && (Math.abs(dx) >= DISTANCE || (speed > FLICK && Math.abs(dx) > FLICK_MIN))
                // a word being selected is not a swipe
                && String(window.getSelection?.() ?? '').length === 0;
            if (!swiped) { if (page) springBack(page); return; }

            const step = dx < 0 ? 1 : -1;
            const paths = tabPaths(current.current.study);
            const next = tabIndexOf(current.current.pathname, current.current.study) + step;
            if (next < 0 || next >= paths.length) {
                if (page) springBack(page);
                dispatch(openMenu(next < 0 ? 'left' : 'right'));
                return;
            }
            const go = () => navigate(paths[next], { state: { tabSwipe: step } });
            if (!page) { go(); return; }
            // the old page carries on the way the finger threw it, then the new one comes in
            page.style.transition = `transform ${OUT_MS}ms ease-in, opacity ${OUT_MS}ms ease-in`;
            page.style.transform = `translateX(${-step * window.innerWidth * 0.3}px)`;
            page.style.opacity = '0';
            clearTimeout(leaving);
            leaving = setTimeout(go, OUT_MS);
        };

        const onCancel = () => {
            if (gesture?.page) springBack(gesture.page);
            gesture = null;
        };

        document.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd, { passive: true });
        document.addEventListener('touchcancel', onCancel, { passive: true });
        return () => {
            clearTimeout(leaving);
            document.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('touchcancel', onCancel);
        };
    }, [enabled, navigate, dispatch]);
}
