import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clampPlacement, cropSquare, ZOOM_MAX } from '../../features/profile/avatars';
import { useSheet } from '../../features/layout/dragDismiss';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import styles from './AvatarCropper.module.css';

const START = { zoom: 1, x: 0, y: 0 };
const KEY_STEP = 0.03;

// Placing a new profile picture: the picture under a round window, moved by dragging (or the
// arrow keys), zoomed with the slider, the wheel or two fingers. What is inside the circle is
// what is kept (circlePicture in avatars.js cuts it out). onDone(placement) / onClose.
export default function AvatarCropper({ image, busy = false, onDone, onClose }) {
    const { t } = useTranslation();
    const titleId = useId();
    const sheet = useSheet(onClose);
    const { dismiss } = sheet;
    const stage = useRef(null);
    const [placement, setPlacement] = useState(START);
    const pointers = useRef(new Map());
    const gesture = useRef(null);

    const place = (next) => setPlacement(prev => clampPlacement(image, typeof next === 'function' ? next(prev) : next));

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dismiss]);

    // the wheel zooms (not passive: the page mustn't scroll meanwhile)
    useEffect(() => {
        const el = stage.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            place(prev => ({ ...prev, zoom: prev.zoom * Math.exp(-e.deltaY / 400) }));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    // place only depends on the image
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [image]);

    const width = () => stage.current?.getBoundingClientRect().width || 1;
    const spread = () => {
        const [a, b] = [...pointers.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        gesture.current = { placement, pointer: { x: e.clientX, y: e.clientY }, spread: pointers.current.size === 2 ? spread() : null };
    };
    const onPointerMove = (e) => {
        if (!pointers.current.has(e.pointerId) || !gesture.current) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const start = gesture.current;
        if (pointers.current.size === 2 && start.spread) {
            place({ ...start.placement, zoom: start.placement.zoom * (spread() / start.spread) });
            return;
        }
        // one circle width dragged = the picture moved by one circle width
        const w = width();
        place({ ...start.placement, x: start.placement.x + (e.clientX - start.pointer.x) / w, y: start.placement.y + (e.clientY - start.pointer.y) / w });
    };
    const onPointerUp = (e) => {
        pointers.current.delete(e.pointerId);
        const [rest] = [...pointers.current.values()];
        gesture.current = rest ? { placement, pointer: rest, spread: null } : null;
    };
    const onKeyDown = (e) => {
        const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (move) {
            e.preventDefault();
            place(prev => ({ ...prev, x: prev.x + move[0] * KEY_STEP, y: prev.y + move[1] * KEY_STEP }));
        }
        if (e.key === '+' || e.key === '=') place(prev => ({ ...prev, zoom: prev.zoom * 1.1 }));
        if (e.key === '-') place(prev => ({ ...prev, zoom: prev.zoom / 1.1 }));
    };

    // the picture drawn so that cropSquare's square fills the stage exactly
    const { sx, sy, side } = cropSquare(image, placement);
    const scale = 100 / side; // % of the stage per source pixel
    const pictureStyle = {
        width: `${image.width * scale}%`,
        height: `${image.height * scale}%`,
        left: `${-sx * scale}%`,
        top: `${-sy * scale}%`,
    };

    return createPortal(
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <div className={styles.head} data-sheet-drag>
                    <h2 id={titleId} className={styles.title}>{t('avatarCropTitle')}</h2>
                    <button type="button" className={styles.close} onClick={() => dismiss()} aria-label={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <p className={styles.intro}>{t('avatarCropHint')}</p>

                <div ref={stage} className={styles.stage} tabIndex={0} role="img" aria-label={t('avatarCropArea')}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                    onKeyDown={onKeyDown}>
                    <img className={styles.picture} src={image.src} alt="" draggable={false} style={pictureStyle} />
                    <span className={styles.ring} aria-hidden="true" />
                </div>

                <label className={styles.zoom}>
                    <Icon name="image" size={14} />
                    <span className={styles.srOnly}>{t('avatarCropZoom')}</span>
                    <input type="range" min="1" max={ZOOM_MAX} step="0.01" value={placement.zoom}
                        onChange={(e) => place(prev => ({ ...prev, zoom: Number(e.target.value) }))} />
                    <Icon name="image" size={20} />
                </label>

                <div className={styles.actions}>
                    <button type="button" className={styles.quiet} onClick={() => place(START)}>{t('avatarCropReset')}</button>
                    <button type="button" className={styles.quiet} onClick={() => dismiss()}>{t('cancel')}</button>
                    <button type="button" className={styles.primary} disabled={busy} onClick={() => onDone(placement)}>
                        {busy ? t('avatarCropSaving') : t('avatarCropSave')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
