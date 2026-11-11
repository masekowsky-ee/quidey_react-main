import { useCallback, useEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import { spring } from '../settings/motion';
import { PHONE_QUERY } from './breakpoints';

// Dragging a sheet down (phones) or the drawer to the side to put it away, the way a real object
// moves: it follows the finger 1:1 from where it was grabbed, resists past its resting place
// (rubber band), and on release goes where the flick was heading, carrying the finger's speed
// into the spring. Grabbing it again while it springs takes it from where it is on screen.

// how far a flick carries on (Apple's scroll deceleration), px
export function project(velocity, decelerationRate = 0.998) {
    return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// the further past the edge, the less it follows
export function rubberband(overshoot, dimension, constant = 0.55) {
    if (dimension <= 0) return 0;
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// px/s over the last ~100 ms of pointer samples ({ at, t }), 0 when the finger stood still
export function velocityOf(samples, now = samples.at(-1)?.t ?? 0) {
    const recent = samples.filter(sample => now - sample.t <= 100);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent.at(-1);
    const dt = (last.t - first.t) / 1000;
    return dt > 0 ? (last.at - first.at) / dt : 0;
}

// dismiss when the projected resting place is past half the panel (a flick from anywhere works)
export function shouldDismiss(offset, velocity, size) {
    return offset + project(velocity) > size / 2;
}

// A dialog that slides in (index.css, "Sheets": up from the bottom edge on phones, a short way
// up elsewhere) over a dimmed, blurred page: spread `backdrop` on its backdrop and `panel` on
// the dialog, put <SheetGrabber /> first in it and data-sheet-drag on its head.
// Pulled down far enough (or flicked), it calls onClose, the same as a click next to it.
// `dismiss(then?)` puts it away the way it came (close button, Escape, a click next to it), then
// calls `then` (default onClose). `open`: for a component that stays mounted while the dialog is
// closed, so the gestures attach once the panel is there.
export function useSheet(onClose, ref, open = true) {
    const ownRef = useRef(null);
    // a form that swaps for another inside the same sheet (the add form's task / note / reminder)
    // mounts a new panel element: the gestures follow it (`element` is in the effect's deps)
    const [element, setElement] = useState(null);
    const attach = useCallback((node) => {
        ownRef.current = node;
        if (node) setElement(node);
    }, []);
    const panelRef = ref ?? ownRef;
    const { dismiss } = useDragDismiss(panelRef, { onDismiss: onClose, enabled: open, from: SHEET_HANDLES, element });
    return {
        backdrop: { 'data-sheet-backdrop': '' },
        panel: { ref: ref ?? attach, 'data-sheet': '' },
        dismiss,
    };
}

const SHEET_HANDLES = '[data-sheet-grabber], [data-sheet-drag]';

// A sheet that opens to be typed into: the field gets the focus once the sheet is in place. With a
// mouse at once; on a touch screen only after the slide-in, since the on-screen keyboard shrinks the
// window (the Android app, phone browsers) and the sheet, resting on the bottom edge, would jump
// while it still moves. So the sheet comes up first, then the keyboard. A field tapped meanwhile
// keeps the focus. Returns a cleanup (the sheet closed before it arrived: nothing happens).
export function focusOnArrival(field) {
    if (!field) return () => {};
    const moving = field.closest('[data-sheet]')?.getAnimations?.().filter(animation => animation.playState === 'running') ?? [];
    if (moving.length === 0 || window.matchMedia?.('(pointer: fine)')?.matches) {
        field.focus();
        return () => {};
    }
    let gone = false;
    const arrive = () => {
        if (gone || !field.isConnected || document.activeElement?.closest?.(KEEP)) return;
        field.focus({ preventScroll: true });
    };
    Promise.all(moving.map(animation => animation.finished)).then(arrive, arrive);
    return () => { gone = true; };
}

// the same as the field's autoFocus
export function useFocusOnArrival(ref) {
    useEffect(() => focusOnArrival(ref.current), [ref]);
}

// a few pixels before it counts as a drag, so taps (the close button in a sheet's head) still tap
const SLOP = 10;
// fields keep their own gestures (selecting text, sliders)
const KEEP = 'input, textarea, select, [contenteditable="true"], [data-no-drag]';
// away from a phone a sheet only rises this far (sheetRise in index.css: 3rem) and leaves the same way
const LIFT = 48;

const reducedMotion = () => document.documentElement.dataset.motion === 'minimal'
    || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

// ref: the panel. onDismiss: put it away (called once the panel is out of sight).
// axis 'y' + direction 1: a sheet pulled down; axis 'x' + direction -1: a drawer pushed left.
// from: a CSS selector inside the panel where a drag may start (a sheet's grabber and head);
// without it, anywhere (the drawer, which only scrolls up and down).
// media: only while this query matches (sheets are sheets on phones only).
// Returns { dismiss(then?) }: animates it away as if it had been flicked, then calls `then` or
// onDismiss; at once without motion or before the panel is laid out (tests).
export function useDragDismiss(ref, { onDismiss, enabled = true, axis = 'y', direction = 1, from, media = PHONE_QUERY, element }) {
    const dismissRef = useRef(onDismiss);
    useEffect(() => { dismissRef.current = onDismiss; });
    const leaveRef = useRef(null);
    const dismiss = useCallback((then) => {
        const done = typeof then === 'function' ? then : dismissRef.current;
        if (leaveRef.current) leaveRef.current(done);
        else done?.();
    }, []);

    useEffect(() => {
        const panel = ref.current;
        if (!enabled || !panel) return undefined;
        const query = media ? window.matchMedia?.(media) : null;
        const horizontal = axis === 'x';
        let gesture = null;
        let offset = 0;
        let spring$ = null;
        let swallowClick = false;
        let leaving = false;

        const size = () => (horizontal ? panel.offsetWidth : panel.offsetHeight) || 1;
        // the dimming and blur behind it lighten as it goes (the backdrop reads --drag-progress)
        const backdrop = () => panel.closest('[data-sheet-backdrop]') ?? panel.parentElement?.querySelector?.('[data-drawer-overlay]');
        // travel: how far "all the way away" is: the panel's size, or LIFT for a sheet that only
        // rose a little (it fades as it goes, the way it came)
        const paint = (value, travel = size(), fade = false) => {
            offset = value;
            panel.style.transform = value === 0 ? '' : (horizontal ? `translateX(${value * direction}px)` : `translateY(${value * direction}px)`);
            const progress = Math.max(0, Math.min(1, value / travel));
            if (fade) panel.style.opacity = String(1 - progress);
            backdrop()?.style.setProperty('--drag-progress', String(progress));
        };
        const reset = () => {
            panel.style.transition = '';
            panel.style.opacity = '';
            panel.removeAttribute('data-dragging');
            paint(0);
            backdrop()?.style.removeProperty('--drag-progress');
        };

        // put away by a button or a key: the same path and spring as a flick that let it go
        leaveRef.current = (done) => {
            if (leaving) return;
            if (reducedMotion() || panel.offsetHeight === 0) { done?.(); return; }
            leaving = true;
            gesture = null;
            spring$?.stop();
            const lift = Boolean(query && !query.matches);
            const travel = lift ? LIFT : size();
            panel.style.transition = 'none';
            spring$ = animate(offset, travel, {
                ...spring(0.3, 1),
                onUpdate: value => paint(value, travel, lift),
                onComplete: () => {
                    spring$ = null;
                    done?.();
                    // still here (the close was refused): back in its place
                    requestAnimationFrame(() => { leaving = false; reset(); });
                },
            });
        };
        const along = (e) => (horizontal ? e.clientX : e.clientY) * direction;
        const across = (e) => (horizontal ? e.clientY : e.clientX);

        const onDown = (e) => {
            if (leaving || !e.isPrimary || e.button !== 0 || (query && !query.matches)) return;
            if (e.target.closest?.(KEEP)) return;
            if (from && !e.target.closest?.(from)) return;
            if (!from && !horizontal && panel.scrollTop > 0) return;
            // caught mid-spring: carry on from where it is on screen
            spring$?.stop();
            spring$ = null;
            gesture = { id: e.pointerId, start: along(e) - offset, startAcross: across(e), active: offset !== 0, samples: [] };
            if (gesture.active) begin(e);
        };

        const begin = (e) => {
            gesture.active = true;
            panel.setAttribute('data-dragging', '');
            panel.style.transition = 'none';
            try { panel.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
        };

        const onMove = (e) => {
            if (!gesture || e.pointerId !== gesture.id) return;
            const moved = along(e) - gesture.start;
            if (!gesture.active) {
                const sideways = Math.abs(across(e) - gesture.startAcross);
                // scrolling or swiping the other way: not ours
                if (sideways > SLOP && sideways > Math.abs(moved)) { gesture = null; return; }
                if (Math.abs(moved) < SLOP) return;
                // the drag starts here, without a jump: the slop is taken off
                gesture.start += Math.sign(moved) * SLOP;
                begin(e);
            }
            const raw = along(e) - gesture.start;
            gesture.samples.push({ at: raw, t: e.timeStamp });
            if (gesture.samples.length > 8) gesture.samples.shift();
            // away: 1:1 with the finger; the other way: it resists, it has nowhere to go
            paint(raw >= 0 ? raw : rubberband(raw, size()));
            e.preventDefault();
        };

        const onUp = (e) => {
            if (!gesture || e.pointerId !== gesture.id) return;
            const { active, samples } = gesture;
            gesture = null;
            if (!active) return;
            swallowClick = true;
            setTimeout(() => { swallowClick = false; }, 0);
            const velocity = e.type === 'pointercancel' ? 0 : velocityOf(samples, e.timeStamp);
            const away = shouldDismiss(offset, velocity, size());
            const target = away ? size() : 0;
            if (away && reducedMotion()) { reset(); dismissRef.current?.(); return; }
            // the release speed goes into the spring, so there is no seam between finger and motion;
            // back home with a touch of give, since a flick brought it there
            spring$ = animate(offset, target, {
                ...spring(away ? 0.3 : 0.35, away ? 1 : 0.85),
                velocity,
                onUpdate: paint,
                onComplete: () => {
                    spring$ = null;
                    if (away) { dismissRef.current?.(); requestAnimationFrame(reset); }
                    else reset();
                },
            });
        };

        // the click that ends a drag on the close button isn't a click
        const onClick = (e) => {
            if (!swallowClick) return;
            e.stopPropagation();
            e.preventDefault();
        };

        panel.addEventListener('pointerdown', onDown);
        panel.addEventListener('pointermove', onMove);
        panel.addEventListener('pointerup', onUp);
        panel.addEventListener('pointercancel', onUp);
        panel.addEventListener('click', onClick, true);
        return () => {
            spring$?.stop();
            leaveRef.current = null;
            panel.removeEventListener('pointerdown', onDown);
            panel.removeEventListener('pointermove', onMove);
            panel.removeEventListener('pointerup', onUp);
            panel.removeEventListener('pointercancel', onUp);
            panel.removeEventListener('click', onClick, true);
            reset();
        };
    }, [ref, enabled, axis, direction, from, media, element]);

    return { dismiss };
}
