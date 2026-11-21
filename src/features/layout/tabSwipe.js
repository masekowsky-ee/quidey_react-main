import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isCommunityPath } from '../community/paths';
import { NAV, paths, tabIds } from '../app/navTable';
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
export const tabPaths = (study = false) => tabIds(study).map(id => NAV[id].path);
export const TAB_PATHS = tabPaths(false);

const isStudyPath = (pathname) => pathname === paths.study || pathname.startsWith(`${paths.study}/`);

export function tabIndexOf(pathname, study = false) {
    if (pathname === paths.home) return 0;
    if (pathname === paths.calendar || pathname.startsWith(`${paths.calendar}/`)) return 1;
    if (pathname === paths.focus || pathname.startsWith(`${paths.focus}/`)) return 2;
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

const overlayOpen = () => Boolean(document.querySelector('[aria-modal="true"], [data-sheet-backdrop], [data-drawer-overlay]'));

// the current page's wrapper (App.jsx: the motion.div inside <main>)
const pageOf = () => document.querySelector('[data-part="main"] > *');
const moves = () => document.documentElement.getAttribute('data-motion') !== 'minimal';

// the page at dx px from its place; it fades as it leaves: a little while the finger holds it, and
// completely by the end of the way out (fadeEnd), so nothing is cut off when the next page comes
function paint(page, dx, fadeEnd = window.innerWidth * 2.5) {
    page.style.transition = 'none';
    page.style.willChange = dx === 0 ? '' : 'transform, opacity';
    page.style.transform = dx === 0 ? '' : `translate3d(${dx}px, 0, 0)`;
    page.style.opacity = dx === 0 ? '' : String(Math.max(0, 1 - Math.min(1, Math.abs(dx) / fadeEnd)));
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

        const show = (page, value, fadeEnd) => { offset = value; paint(page, value, fadeEnd); };
        // to the target with the finger's speed; going out (target != 0) the next page is called as
        // soon as this one is all but gone, not after the spring's long tail
        const settle = (page, target, velocity, done) => {
            spring$?.stop();
            const leaving = target !== 0;
            let called = false;
            const finish = () => {
                if (called) return;
                called = true;
                spring$?.stop();
                spring$ = null;
                done?.();
            };
            spring$ = animate(offset, target, {
                ...spring(leaving ? 0.2 : 0.35, 1),
                velocity,
                onUpdate: (value) => {
                    show(page, value, leaving ? Math.abs(target) : undefined);
                    if (leaving && Math.abs(value) >= Math.abs(target) * 0.96) finish();
                },
                onComplete: finish,
            });
        };

        const onStart = (e) => {
            gesture = null;
            if (!phone.matches || e.touches.length !== 1 || current.current.menuOpen || overlayOpen()) return;
            if (tabIndexOf(current.current.pathname, current.current.study) < 0 || ownsSwipe(e.target)) return;
            const touch = e.touches[0];
            // the screen's edges belong to the system's back gesture
            if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
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
            const heading = raw + project(velocity);
            const swiped = raw !== 0 && Math.sign(heading) === Math.sign(raw)
                && Math.abs(dy) * SIDEWAYS <= Math.abs(raw)
                && (Math.abs(heading) >= SHARE * window.innerWidth || Math.abs(raw) >= DISTANCE)
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
            settle(page, -step * window.innerWidth * 0.4, velocity, go);
        };

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
