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

const EASE = [0.32, 0.72, 0, 1];
const BOUNCY = { type: 'spring', stiffness: 380, damping: 18, mass: 0.9 };
const SOFT_SPRING = { type: 'spring', stiffness: 220, damping: 22 };

const LIVELY_SPRING = { type: 'spring', stiffness: 340, damping: 22 };

// The motion props per level for each animated part of the app
export const MOTION = {
    // whole page on navigation: minimal rises a little, normal springs up, extreme out of a blur.
    // The filter is removed at the end, a transform or filter left on the wrapper would trap the
    // pages' fixed parts
    page: {
        minimal: {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.35, ease: EASE },
        },
        normal: {
            initial: { opacity: 0, y: 28, scale: 0.97 },
            animate: { opacity: 1, y: 0, scale: 1 },
            transition: { type: 'spring', stiffness: 260, damping: 24, opacity: { duration: 0.3 } },
        },
        extreme: {
            initial: { opacity: 0, y: 48, scale: 0.94, filter: 'blur(10px)' },
            animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
            transition: { ...SOFT_SPRING, opacity: { duration: 0.3 }, filter: { duration: 0.45 } },
        },
    },
    // task rows: in, out, and sliding to a new place
    row: {
        minimal: {
            layout: 'position',
            initial: { opacity: 0, y: 10, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, x: 24, transition: { duration: 0.2 } },
            transition: { type: 'spring', stiffness: 320, damping: 28 },
        },
        normal: {
            layout: true,
            initial: { opacity: 0, x: -36, scale: 0.93, rotate: -1 },
            animate: { opacity: 1, x: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, x: 90, scale: 0.86, rotate: 3, transition: { duration: 0.28, ease: 'backIn' } },
            whileHover: { x: 3, transition: LIVELY_SPRING },
            transition: LIVELY_SPRING,
        },
        extreme: {
            layout: true,
            initial: { opacity: 0, x: -80, scale: 0.85, rotate: -3 },
            animate: { opacity: 1, x: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, x: 160, scale: 0.7, rotate: 8, transition: { duration: 0.35, ease: 'backIn' } },
            whileHover: { x: 6, transition: BOUNCY },
            transition: BOUNCY,
        },
    },
    toast: {
        minimal: {
            layout: true,
            initial: { opacity: 0, y: 24, scale: 0.92 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, scale: 0.95, transition: { duration: 0.18 } },
            transition: { type: 'spring', stiffness: 420, damping: 26 },
        },
        normal: {
            layout: true,
            initial: { opacity: 0, y: 50, scale: 0.7, rotate: -4 },
            animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, y: 14, scale: 0.75, rotate: 3, transition: { duration: 0.22 } },
            transition: { type: 'spring', stiffness: 460, damping: 20 },
        },
        extreme: {
            layout: true,
            initial: { opacity: 0, y: 80, scale: 0.4, rotate: -10 },
            animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
            exit: { opacity: 0, y: 30, scale: 0.5, rotate: 6, transition: { duration: 0.25 } },
            transition: { type: 'spring', stiffness: 500, damping: 14 },
        },
    },
    overlay: {
        minimal: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.25 },
        },
        normal: {
            initial: { opacity: 0, backdropFilter: 'blur(0px)' },
            animate: { opacity: 1, backdropFilter: 'blur(3px)' },
            exit: { opacity: 0, backdropFilter: 'blur(0px)' },
            transition: { duration: 0.32 },
        },
        extreme: {
            initial: { opacity: 0, backdropFilter: 'blur(0px)' },
            animate: { opacity: 1, backdropFilter: 'blur(6px)' },
            exit: { opacity: 0, backdropFilter: 'blur(0px)' },
            transition: { duration: 0.4 },
        },
    },
    // a game on the fun page when it starts
    game: {
        minimal: {
            initial: { opacity: 0, y: 16, scale: 0.97 },
            animate: { opacity: 1, y: 0, scale: 1 },
            transition: { type: 'spring', stiffness: 260, damping: 24 },
        },
        normal: {
            initial: { opacity: 0, y: 36, scale: 0.9, rotateX: -22 },
            animate: { opacity: 1, y: 0, scale: 1, rotateX: 0 },
            transition: { type: 'spring', stiffness: 230, damping: 19 },
        },
        extreme: {
            initial: { opacity: 0, y: 60, scale: 0.8, rotateX: -50 },
            animate: { opacity: 1, y: 0, scale: 1, rotateX: 0 },
            transition: { type: 'spring', stiffness: 200, damping: 15 },
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
