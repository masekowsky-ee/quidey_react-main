import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { tipsForPage, useTips, markTipSeen, turnTipsOff, syncTips } from '../../features/tips/tips';
import styles from './FeatureTips.module.css';

// how often the page is looked at for a tip's control (it may still be loading, or a sheet is open)
const LOOK_MS = 400;
// room kept to the window's edges, and between the control and the tip
const EDGE = 10;
const GAP = 12;

// something over the page: a sheet, a dialog, the drawer (or the calm Fokusraum). Then only a control
// on it can have its tip (the colour picker in a form, an entry of the drawer).
const OVERLAY = '[aria-modal="true"], [data-sheet-backdrop], [data-drawer-overlay]';
const overlayOpen = () => Boolean(document.querySelector(`${OVERLAY}, [data-calm]`));
const onOverlay = (el) => !document.querySelector('[data-calm]')
    && Boolean(el.closest(`${OVERLAY}, [data-part="menu"]`));

function visibleRect(el) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;
    if (el.closest('[inert], [aria-hidden="true"]')) return null;
    return rect;
}

// the first match of the selector list that can be seen
function findTarget(selector) {
    for (const el of document.querySelectorAll(selector)) {
        if (visibleRect(el)) return el;
    }
    return null;
}

// Where the tip goes for the control's box as it is now: under it, else over it, else (a control
// taller than the window) inside its top; kept inside the window sideways, the arrow at the
// control's middle. null: the control is scrolled out of sight (tip and ring hide).
function place(rect, box) {
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) return null;
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - box.height;
    let side = 'below';
    let top = below;
    if (below + box.height > vh - EDGE) {
        if (above >= EDGE) { side = 'above'; top = above; }
        else { side = 'inside'; top = Math.max(EDGE, Math.min(rect.top + GAP, vh - box.height - EDGE)); }
    }
    const center = rect.left + rect.width / 2;
    const left = Math.max(EDGE, Math.min(center - box.width / 2, vw - box.width - EDGE));
    const arrow = Math.max(16, Math.min(center - left, box.width - 16));
    return { top, left, arrow, side };
}

// Feature tips (features/tips/tips.js): on a page's first visit its tips show one at a time beside
// the controls they explain, "Weiter" goes to the next, "Tipps ausblenden" ends all of them. A tip
// waits while something covers the page or while its control isn't there. Mounted once in App.
export default function FeatureTips() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const dispatch = useDispatch();
    const signedIn = useSelector(state => Boolean(state.auth.user?.username));
    const tourOpen = useSelector(state => state.settings.showTutorial);
    const tips = useTips();
    const titleId = useId();
    const [found, setCurrent] = useState(null);
    // another tip of this page can be shown after this one ("Weiter" rather than "Fertig")
    const [more, setMore] = useState(false);
    const tipRef = useRef(null);
    const ringRef = useRef(null);
    const targetRef = useRef(null);

    const page = tipsForPage(pathname);
    const pending = tips.off || !signedIn || !tips.ready ? [] : page.filter(tip => !tips.seen.includes(tip.id));
    const pendingKey = pending.map(tip => tip.id).join(',');
    const current = pendingKey && !tourOpen && pending.some(tip => tip.id === found) ? found : null;

    // once the server has answered: join what this device saw meanwhile (before any tip is looked for)
    const username = useSelector(state => state.auth.user?.username);
    useEffect(() => {
        if (tips.ready && username) dispatch(syncTips());
    }, [tips.ready, username, dispatch]);

    // look for the first pending tip whose control is on the screen
    useEffect(() => {
        if (!pendingKey || tourOpen) return undefined;
        const ids = pendingKey.split(',');
        const look = () => {
            const covered = overlayOpen();
            const shown = tipsForPage(pathname)
                .filter(tip => ids.includes(tip.id))
                .map(tip => ({ id: tip.id, target: findTarget(tip.target) }))
                .filter(item => item.target && (!covered || onOverlay(item.target)));
            if (shown.length === 0) { setCurrent(null); return; }
            targetRef.current = shown[0].target;
            setMore(shown.length > 1);
            setCurrent(shown[0].id);
        };
        look();
        const timer = setInterval(look, LOOK_MS);
        return () => clearInterval(timer);
    }, [pendingKey, pathname, tourOpen]);

    // Tip and ring stay on the control: every frame they are put where its box is now, written straight
    // to their style (not through React), so they move in the very frame the page scrolls, and the
    // ring is the control's box exactly, also when it grows or shrinks.
    useLayoutEffect(() => {
        if (!current) return undefined;
        let frame = 0;
        let last = '';
        const follow = () => {
            frame = requestAnimationFrame(follow);
            const target = targetRef.current;
            const tip = tipRef.current;
            const ring = ringRef.current;
            if (!target?.isConnected || !tip || !ring) return;
            const rect = target.getBoundingClientRect();
            const spot = place(rect, { width: tip.offsetWidth, height: tip.offsetHeight });
            const key = spot ? `${rect.top},${rect.left},${rect.width},${rect.height},${spot.top},${spot.left},${spot.side}` : 'away';
            if (key === last) return;
            last = key;
            if (!spot) {
                tip.removeAttribute('data-placed');
                ring.removeAttribute('data-placed');
                return;
            }
            Object.assign(tip.style, { top: `${spot.top}px`, left: `${spot.left}px` });
            tip.style.setProperty('--arrow', `${spot.arrow}px`);
            tip.dataset.side = spot.side;
            Object.assign(ring.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
            ring.style.borderRadius = getComputedStyle(target).borderRadius;
            tip.setAttribute('data-placed', '');
            ring.setAttribute('data-placed', '');
        };
        follow();
        return () => cancelAnimationFrame(frame);
    }, [current]);

    useEffect(() => {
        if (!current) return undefined;
        // before the sheet's own Escape, which would close it with the tip on it
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            dispatch(markTipSeen(current));
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [current, dispatch]);

    // using the control the tip points at answers it: the tip goes (a click, a tap, typing or focus in it)
    useEffect(() => {
        if (!current) return undefined;
        const used = (e) => {
            const target = targetRef.current;
            if (target && e.target instanceof Node && target.contains(e.target) && !tipRef.current?.contains(e.target)) dispatch(markTipSeen(current));
        };
        const events = ['click', 'input', 'focusin'];
        for (const name of events) document.addEventListener(name, used, true);
        return () => { for (const name of events) document.removeEventListener(name, used, true); };
    }, [current, dispatch]);

    if (!current) return null;
    const next = () => dispatch(markTipSeen(current));

    return (
        <>
            <div ref={ringRef} key={`ring-${current}`} className={styles.ring} aria-hidden="true" />
            <div ref={tipRef} key={`tip-${current}`} className={styles.tip} role="dialog" aria-modal="false" aria-labelledby={titleId}
                data-tip-id={current}>
                <span className={styles.arrow} aria-hidden="true" />
                <p id={titleId} className={styles.title}>{t(`tip_${current}_title`)}</p>
                <p className={styles.text}>{t(`tip_${current}_text`)}</p>
                <div className={styles.actions}>
                    <button type="button" className={styles.off} onClick={() => dispatch(turnTipsOff())}>{t('tipsOff')}</button>
                    <button type="button" className={styles.next} onClick={next}>
                        {more ? t('tipNext') : t('tipDone')}
                    </button>
                </div>
            </div>
        </>
    );
}
