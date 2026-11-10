import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { useCalm } from '../../features/focus/calm';
import { runsInBrowser } from '../../features/pwa/install';
import { selectFocusTask } from '../../features/session/sessionAction';
import { stopNoise } from '../../features/focus/noise';
import { useTranslation } from '../../i18n/useTranslation';
import FocusGoal from './FocusGoal.jsx';
import FocusTimer from './FocusTimer.jsx';
import SessionNotes from './SessionNotes.jsx';
import FocusSettingsSheet from './FocusSettingsSheet.jsx';
import { RoundRecap } from './StudyTools.jsx';
import { useStored } from '../../features/focus/useStored';
import Icon from '../icons.jsx';
import styles from './FocusRoom.module.css';

// Full screen: nothing but the Fokusraum (Escape leaves it). Only in a browser tab: the Android
// app and the installed web app have no browser bars to hide.
function useFullscreen() {
    const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
    useEffect(() => {
        const update = () => setFull(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    const supported = runsInBrowser() && typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
    const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    return { full, toggle, supported };
}

// The Fokusraum (/focus), three steps and nothing else in sight: what this session is for (and
// its task), the timer, and the session's note waiting beside it. Everything else (today's
// numbers, Pomodoro lengths, focus sounds, study methods, the thought parking lot, routines,
// full screen) sits behind "Fokus-Einstellungen". The recap shows up only in a Pomodoro break.
export default function FocusRoom() {
    const { t } = useTranslation();
    const task = useSelector(selectFocusTask);
    const [goal, setGoal] = useStored('focusIntent', '');
    const [notesVersion, setNotesVersion] = useState(0);
    const [settings, setSettings] = useState(false);
    const fullscreen = useFullscreen();
    const calm = useCalm(useLocation().pathname);

    // focus sounds play on while the settings are closed, and stop when the Fokusraum is left
    useEffect(() => () => stopNoise(), []);

    return (
        <div className={styles.page} data-part="focus-room">
            <header className={styles.head}>
                <h1 className={styles.title}>{t('focusRoom')}</h1>
                <div className={styles.headActions}>
                    {/* calm mode hides the navigation while the round runs: the one way out */}
                    {calm && <Link to="/" className={styles.ghostLink}><Icon name="release" size={16} /> {t('focusCalmLeave')}</Link>}
                    <button type="button" className={styles.ghostLink} onClick={() => setSettings(true)} aria-haspopup="dialog" data-tip="focus-settings">
                        <Icon name="settings" size={16} /> {t('focusSettings')}
                    </button>
                </div>
            </header>

            <div className={styles.columns}>
                <div className={styles.mainCol}>
                    <FocusGoal goal={goal} onGoal={setGoal} task={task} />
                    <FocusTimer />
                    <RoundRecap focusTask={task} onSaved={() => setNotesVersion(v => v + 1)} />
                </div>
                <SessionNotes key={notesVersion} goal={goal} focusTask={task} />
            </div>

            {settings && <FocusSettingsSheet onClose={() => setSettings(false)} fullscreen={fullscreen} />}
        </div>
    );
}
