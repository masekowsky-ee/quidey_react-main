import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useSheet } from '../../features/layout/dragDismiss';
import { fill, sameDay, parseDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { PomodoroLengths } from './FocusTimer.jsx';
import { useAwayTally, todaysAway } from '../../features/focus/away';
import { useCalmSetting, setCalm } from '../../features/focus/calm';
import { awayPlatform } from '../../features/focus/useFocusAway';
import { ParkingLot, FocusSounds, StudyMethod } from './StudyTools.jsx';
import styles from './FocusRoom.module.css';

// Today in numbers: focus minutes and sessions (saved ones plus the one going on)
function TodayLine() {
    const { t } = useTranslation();
    const saved = useSelector(state => state.session.workedSessionData);
    const current = useSelector(state => state.session.currentSessionData.totalTime);
    const { round } = useSelector(state => state.session.pomodoro);
    const today = new Date();
    const todays = saved.filter(session => { const d = parseDate(session.date); return d && sameDay(d, today); });
    const minutes = Math.round((todays.reduce((sum, s) => sum + (s.totalTime ?? 0), 0) + current) / 60);
    // time elsewhere during focus, only where a screen turned off can be told apart (useFocusAway.js)
    const away = todaysAway(useAwayTally());
    const tracked = awayPlatform() !== null;
    return (
        <p className={styles.todayLine}>
            <span>{fill(t('focusTodayMinutes'), { n: minutes })}</span>
            <span>{fill(t(todays.length === 1 ? 'focusTodaySessionsOne' : 'focusTodaySessions'), { n: todays.length })}</span>
            {round > 0 && <span>{fill(t('focusTodayPomodoros'), { n: round })}</span>}
            {tracked && (minutes > 0 || away.count > 0) &&
                <span>{away.count ? fill(t('awayToday'), { n: away.count, min: Math.max(1, Math.round(away.ms / 60000)) }) : t('awayTodayNone')}</span>}
        </p>
    );
}

// calm mode on / off (features/focus/calm.js)
function CalmSwitch() {
    const { t } = useTranslation();
    const on = useCalmSetting();
    return (
        <section className={styles.tool} aria-labelledby="focus-calm-title">
            <h3 id="focus-calm-title" className={styles.toolTitle}><Icon name="eyeOff" size={16} /> {t('focusCalmTitle')}</h3>
            <label className={styles.switchRow}>
                <input type="checkbox" checked={on} onChange={e => setCalm(e.target.checked)} />
                <span>{t('focusCalmLabel')}</span>
            </label>
            <p className={styles.toolHint}>{t('focusCalmHint')}</p>
        </section>
    );
}

// Fokus-Einstellungen: everything the Fokusraum has besides goal, timer and notes. A sheet
// (pulled down, Escape, the cross or a click beside it closes it). fullscreen: { full, toggle,
// supported } from the page.
export default function FocusSettingsSheet({ onClose, fullscreen }) {
    const { t } = useTranslation();
    const titleId = useId();
    const closeRef = useRef(null);
    const sheet = useSheet(onClose);
    const { dismiss } = sheet;

    useEffect(() => {
        const previous = document.activeElement;
        closeRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            dismiss();
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, [dismiss]);

    return createPortal(
        <div className={styles.settingsBackdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={styles.settingsSheet} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <div className={styles.settingsHead} data-sheet-drag>
                    <h2 id={titleId} className={styles.settingsTitle}>{t('focusSettings')}</h2>
                    <button type="button" ref={closeRef} className={styles.iconMini} onClick={() => dismiss()} aria-label={t('focusSettingsClose')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className={styles.settingsBody}>
                    <section className={styles.tool} aria-labelledby="focus-today-title">
                        <h3 id="focus-today-title" className={styles.toolTitle}><Icon name="focus" size={16} /> {t('focusSettingsToday')}</h3>
                        <TodayLine />
                    </section>
                    <CalmSwitch />
                    <section className={styles.tool} aria-labelledby="focus-lengths-title">
                        <h3 id="focus-lengths-title" className={styles.toolTitle}><Icon name="timer" size={16} /> {t('focusSettingsLengths')}</h3>
                        <PomodoroLengths />
                    </section>
                    <FocusSounds />
                    <StudyMethod />
                    <ParkingLot />
                    <div className={styles.settingsLinks}>
                        <Link to="/routines" className={styles.ghostLink} onClick={() => onClose()}><Icon name="routine" size={16} /> {t('routines')}</Link>
                        {fullscreen.supported &&
                            <button type="button" className={styles.ghostLink} onClick={fullscreen.toggle} aria-pressed={fullscreen.full}>
                                <Icon name="expand" size={16} /> {fullscreen.full ? t('focusFullscreenLeave') : t('focusFullscreen')}
                            </button>}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
