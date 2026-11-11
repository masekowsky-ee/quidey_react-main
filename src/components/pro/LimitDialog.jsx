import styles from '../PushOffer.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useProOn } from '../../features/pro/flag';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { fetchAccess } from '../../features/auth/authAction';
import { LIMIT_EVENT } from '../../features/pro/pro';
import Icon from '../icons';

// The free plan is full (after the beta: 403 LIMIT_REACHED from any request, see
// features/helperFunction.js): a kind word instead of an error, and the way to Quidey Pro.
// Mounted once in the app shell.
export default function LimitDialog() {
    const [limit, setLimit] = useState(null); // { limit, max }
    const dispatch = useDispatch();
    useEffect(() => {
        const onLimit = (e) => {
            setLimit(e.detail);
            // the counts in the settings / on the Pro page come along
            dispatch(fetchAccess()).catch(() => {});
        };
        window.addEventListener(LIMIT_EVENT, onLimit);
        return () => window.removeEventListener(LIMIT_EVENT, onLimit);
    }, [dispatch]);
    if (!limit) return null;
    return <Question limit={limit} onClose={() => setLimit(null)} />;
}

function Question({ limit, onClose }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    // Pro on sale: the Pro page; else (trial version, beta) the beta card
    const proOn = useProOn();
    const titleId = useId();
    const textId = useId();
    const yesRef = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        yesRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, [onClose]);

    const what = ['tasks', 'events', 'groups', 'sessions', 'friends', 'stats', 'subjects', 'goals'].includes(limit.limit) ? limit.limit : 'tasks';
    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
                <span className={styles.badge} aria-hidden="true"><Icon name="heart" size={20} /></span>
                <h2 id={titleId} className={styles.title}>{t('limitTitle')}</h2>
                <p id={textId} className={styles.text}>
                    {fill(t(`limitText_${what}`), { max: limit.max })} {t(proOn ? 'limitPro' : 'limitTrial')}
                </p>
                <button ref={yesRef} type="button" className={styles.yes} onClick={() => { onClose(); navigate(proOn ? '/pro' : '/beta'); }}>
                    <Icon name="heart" size={18} />{t(proOn ? 'limitSeePro' : 'limitSeeBeta')}
                </button>
                <button type="button" className={styles.later} onClick={onClose}>{t('limitLater')}</button>
            </div>
        </div>,
        document.body
    );
}
