import { useEffect } from 'react';
import { useSelector } from 'react-redux';

// How much the app moves: 'minimal' (quiet fades), 'normal' (livelier springs, a little
// confetti) or 'extreme' (big springs, blur, lots of confetti). The opening animation plays on
// every level. Remembered in localStorage like the theme; without a saved choice it follows
// the operating system's "reduce motion" setting.
export const MOTION_LEVELS = ['minimal', 'normal', 'extreme'];
const STORAGE_KEY = 'motion';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

export function readStoredMotion() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (MOTION_LEVELS.includes(stored)) return stored;
    } catch { /* storage blocked: fall back to the system */ }
    return window.matchMedia?.(REDUCE_QUERY).matches ? 'minimal' : 'normal';
}

export function storeMotion(level) {
    try { localStorage.setItem(STORAGE_KEY, level); } catch { /* still applied, just not remembered */ }
}

export const useMotionLevel = () => useSelector((state) => state.settings.motion);

// <html data-motion>: the CSS keeps transitions calm (minimal) or makes them bouncy (normal, extreme)
export function useApplyMotion() {
    const level = useMotionLevel();
    useEffect(() => {
        document.documentElement.dataset.motion = level;
    }, [level]);
}

// Springs the way Apple describes them: a response (seconds to get to the target, not a fixed
// duration) and a damping ratio (1 = settles without overshoot, lower = bouncier), turned into
// Motion's mass/stiffness/damping. Everything starts from where it is on screen and keeps its
// speed when it's redirected, so it can always be interrupted.
export function spring(response = 0.35, dampingRatio = 1) {
    const omega = (2 * Math.PI) / response;
    return { type: 'spring', mass: 1, stiffness: omega * omega, damping: 2 * dampingRatio * omega };
}

// critically damped: the default for anything that just appears or moves
const SETTLE = spring(0.35, 1);
const SETTLE_SLOW = spring(0.45, 1);
// a little overshoot: only on "extreme", where the app is meant to be playful
const BOUNCE = spring(0.4, 0.7);
const BIG_BOUNCE = spring(0.5, 0.55);
const FADE = { duration: 0.2, ease: 'easeOut' };

// The motion props per level for each animated part of the app. "minimal" is the reduced-motion
// rendition (the default when the system asks for less motion): cross-fades only, nothing slides
// or scales. "normal" moves along short paths with critically damped springs: in and out the same
// way, never a bounce that no gesture caused. "extreme" is the playful one.
export const MOTION = {
    // whole page on navigation: minimal fades, normal rises a few pixels, extreme out of a blur.
    // The filter is removed at the end, a transform or filter left on the wrapper would trap the
    // pages' fixed parts
    page: {
        minimal: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: FADE,
        },
        normal: {
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            transition: { ...SETTLE, opacity: { duration: 0.22, ease: 'easeOut' } },
        },
        extreme: {
            initial: { opacity: 0, y: 48, scale: 0.94, filter: 'blur(10px)' },
            animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
            transition: { ...BOUNCE, opacity: { duration: 0.3 }, filter: { duration: 0.45 } },
        },
    },
    // task rows: in, out, and sliding to a new place
    row: {
        minimal: {
            layout: 'position',
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0, transition: { duration: 0.15 } },
            transition: { ...SETTLE, opacity: FADE },
        },
        normal: {
            layout: 'position',
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            // a finished row leaves the way the tick points: to the side, fading
            exit: { opacity: 0, x: 32, transition: { ...SETTLE, opacity: { duration: 0.18 } } },
            transition: SETTLE,
        },
        extreme: {
            layout: true,
            initial: { opacity: 0, x: -80, scale: 0.85, rotate: -3 },
            animate: { opacity: 1, x: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, x: 160, scale: 0.7, rotate: 8, transition: { duration: 0.35, ease: 'backIn' } },
            whileHover: { x: 6, transition: BOUNCE },
            transition: BOUNCE,
        },
    },
    // toasts rise from the bottom edge and go back down it (a swipe sends them its own way)
    toast: {
        minimal: {
            layout: true,
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0, transition: { duration: 0.15 } },
            transition: { ...SETTLE, opacity: FADE },
        },
        normal: {
            layout: true,
            initial: { opacity: 0, y: 32, scale: 0.96 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 24, scale: 0.96, transition: { ...SETTLE, opacity: { duration: 0.18 } } },
            transition: SETTLE,
        },
        extreme: {
            layout: true,
            initial: { opacity: 0, y: 80, scale: 0.4, rotate: -10 },
            animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, y: 30, scale: 0.5, rotate: 6, transition: { duration: 0.25 } },
            transition: BIG_BOUNCE,
        },
    },
    // the dimming behind a drawer: it only dims, a blur behind a moving panel costs every frame
    overlay: {
        minimal: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: FADE,
        },
        normal: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] },
        },
        extreme: {
            initial: { opacity: 0, backdropFilter: 'blur(0px)' },
            animate: { opacity: 1, backdropFilter: 'blur(6px)' },
            exit: { opacity: 0, backdropFilter: 'blur(0px)' },
            transition: { duration: 0.4 },
        },
    },
    // one step of the tutorial coming in; dir is 1 (next) or -1 (back), so back comes from where
    // next went
    tourStep: {
        minimal: () => ({
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: FADE,
        }),
        normal: (dir) => ({
            initial: { opacity: 0, x: 24 * dir },
            animate: { opacity: 1, x: 0 },
            transition: { ...SETTLE, opacity: { duration: 0.2 } },
        }),
        extreme: (dir) => ({
            initial: { opacity: 0, x: 110 * dir, rotate: 6 * dir, scale: 0.9, filter: 'blur(6px)' },
            animate: { opacity: 1, x: 0, rotate: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
            transition: { ...BOUNCE, opacity: { duration: 0.2 }, filter: { duration: 0.3 } },
        }),
    },
    // a game on the fun page when it starts
    game: {
        minimal: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: FADE,
        },
        normal: {
            initial: { opacity: 0, y: 16, scale: 0.97 },
            animate: { opacity: 1, y: 0, scale: 1 },
            transition: SETTLE_SLOW,
        },
        extreme: {
            initial: { opacity: 0, y: 60, scale: 0.8, rotateX: -50 },
            animate: { opacity: 1, y: 0, scale: 1, rotateX: 0 },
            transition: BIG_BOUNCE,
        },
    },
};

// Confetti from a point on the screen (a little on normal, lots on extreme). Plain DOM and the Web Animations API,
// so it costs React nothing and cleans up after itself.
const CONFETTI_COLORS = ['var(--primary)', '#facc15', '#38bdf8', '#fb7185', '#a78bfa', '#4ade80'];

export function burst(x, y, count = 28) {
    if (typeof document === 'undefined' || !document.body.animate) return;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('span');
        const size = 5 + Math.random() * 7;
        Object.assign(piece.style, {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            width: `${size}px`,
            height: `${size * (Math.random() < 0.5 ? 1 : 0.45)}px`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            borderRadius: Math.random() < 0.3 ? '50%' : '2px',
            pointerEvents: 'none',
            zIndex: 2000,
        });
        document.body.appendChild(piece);
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 140;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 80;
        const spin = (Math.random() - 0.5) * 900;
        piece.animate([
            { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 160}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
        ], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' }).onfinish = () => piece.remove();
    }
}

// Confetti from the middle of an element, for click handlers
export function burstFrom(element, count) {
    const rect = element?.getBoundingClientRect?.();
    if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
}

// A win in a game: on "extreme" a big burst in the middle and two from the sides, on "normal"
// just the one in the middle. delay lets the game's own reveal (flipping tiles) finish first.
export function useCelebrate(delay = 0) {
    const level = useMotionLevel();
    return () => {
        if (level === 'minimal') return;
        setTimeout(() => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            if (level === 'normal') { burst(w / 2, h * 0.45, 36); return; }
            burst(w / 2, h * 0.45, 70);
            setTimeout(() => { burst(w * 0.2, h * 0.6, 35); burst(w * 0.8, h * 0.6, 35); }, 200);
        }, delay);
    };
}
