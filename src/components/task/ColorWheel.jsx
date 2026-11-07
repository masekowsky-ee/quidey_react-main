import { useId, useRef, useState } from 'react';
import styles from './ColorWheel.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { HEX_COLOR, hexToHsl, hslToHex } from '../../features/tasks/taskColors';

const START = { h: 200, s: 65, l: 48 };
const HUES = [0, 60, 120, 180, 240, 300, 360];

// A colour of one's own: hue around the wheel, saturation from the grey middle outwards, lightness
// on the slider under it, and the colour as "#rrggbb" to type or copy. Drag on the wheel (mouse,
// pen, finger) or use the arrow keys on it (left/right: hue, up/down: saturation). The colour is
// handed on (onCommit) when the finger lets go, the slider is let go or the code is confirmed, not
// while dragging, so a list that saves at once doesn't save fifty times.
export default function ColorWheel({ value, onCommit }) {
    const { t } = useTranslation();
    const id = useId();
    const [hsl, setHsl] = useState(() => hexToHsl(value) ?? START);
    const [text, setText] = useState(() => (HEX_COLOR.test(value ?? '') ? value : hslToHex(hexToHsl(value) ?? START)));
    const wheelRef = useRef(null);
    const draft = useRef(hsl);
    // what was handed on last: leaving the wheel or the slider hands on only a change
    const sent = useRef(HEX_COLOR.test(value ?? '') ? value : null);

    const show = (next) => {
        draft.current = next;
        setHsl(next);
        setText(hslToHex(next));
    };
    const commit = (next = draft.current) => {
        const hex = hslToHex(next);
        if (hex === sent.current) return;
        sent.current = hex;
        onCommit(hex);
    };

    // the point under the pointer as hue (0 at the top, clockwise) and saturation (0 in the middle)
    const fromPointer = (e) => {
        const box = wheelRef.current.getBoundingClientRect();
        const x = e.clientX - (box.left + box.width / 2);
        const y = e.clientY - (box.top + box.height / 2);
        const h = Math.round((Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360);
        const s = Math.round(Math.min(1, Math.hypot(x, y) / (box.width / 2)) * 100);
        return { ...draft.current, h, s };
    };
    const onPointerDown = (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        show(fromPointer(e));
    };
    const onPointerMove = (e) => {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) show(fromPointer(e));
    };
    const onPointerUp = (e) => {
        if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        commit();
    };
    const onKeyDown = (e) => {
        const step = e.shiftKey ? 15 : 5;
        const { h, s } = draft.current;
        const moves = {
            ArrowLeft: { h: (h - step + 360) % 360 }, ArrowRight: { h: (h + step) % 360 },
            ArrowUp: { s: Math.min(100, s + step) }, ArrowDown: { s: Math.max(0, s - step) },
        };
        if (moves[e.key]) {
            e.preventDefault();
            show({ ...draft.current, ...moves[e.key] });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
    };

    const typed = (raw) => {
        const clean = `#${raw.replace(/[^0-9a-f]/gi, '').slice(0, 6).toLowerCase()}`;
        setText(clean);
        const next = hexToHsl(clean);
        if (next) { draft.current = next; setHsl(next); }
    };

    // the wheel is drawn at the chosen lightness; the marker sits where hue and saturation point
    const ring = `conic-gradient(${HUES.map(h => `hsl(${h} 100% ${hsl.l}%)`).join(', ')})`;
    const middle = `radial-gradient(closest-side, hsl(0 0% ${hsl.l}%), hsl(0 0% ${hsl.l}% / 0))`;
    const angle = (hsl.h - 90) * Math.PI / 180;
    const markerX = Math.cos(angle) * hsl.s / 2;
    const markerY = Math.sin(angle) * hsl.s / 2;
    const hex = hslToHex(hsl);

    return (
        <div className={styles.wheelBox}>
            <div ref={wheelRef} className={styles.wheel} style={{ backgroundImage: `${middle}, ${ring}` }}
                role="slider" tabIndex={0} aria-label={t('colorWheel')} aria-valuetext={hex}
                aria-valuenow={hsl.h} aria-valuemin={0} aria-valuemax={359} aria-describedby={`${id}-keys`}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp} onKeyDown={onKeyDown} onBlur={() => commit()}>
                <span className={styles.marker} style={{ left: `${50 + markerX}%`, top: `${50 + markerY}%`, backgroundColor: hex }} />
            </div>
            <span id={`${id}-keys`} className={styles.srOnly}>{t('colorWheelKeys')}</span>
            <div className={styles.controls}>
                <label className={styles.lightness}>
                    <span>{t('colorLightness')}</span>
                    <input type="range" min="15" max="85" value={hsl.l}
                        style={{ backgroundImage: `linear-gradient(to right, hsl(${hsl.h} ${hsl.s}% 15%), hsl(${hsl.h} ${hsl.s}% 50%), hsl(${hsl.h} ${hsl.s}% 85%))` }}
                        onChange={e => show({ ...draft.current, l: Number(e.target.value) })}
                        onPointerUp={() => commit()} onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') commit(); }} />
                </label>
                <label className={styles.code}>
                    <span className={styles.preview} style={{ backgroundColor: hex }} aria-hidden="true" />
                    <span className={styles.srOnly}>{t('colorCode')}</span>
                    <input type="text" value={text} maxLength={7} spellCheck="false" autoComplete="off"
                        onChange={e => typed(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (HEX_COLOR.test(text)) commit(hexToHsl(text)); } }}
                        onBlur={() => { if (HEX_COLOR.test(text)) commit(hexToHsl(text)); else setText(hex); }} />
                </label>
            </div>
        </div>
    );
}
