import styles from './TourPreview.module.css';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { setAccent, setTheme } from '../../features/settings/settingsAction';
import { ACCENT_SWATCHES } from '../../features/settings/preferences';
import { useMotionLevel } from '../../features/settings/motion';
import Icon from '../icons';
import Logo from '../Logo';
import LevelPlant from '../progress/LevelPlant';
import OnlineDot from '../presence/OnlineDot';
import dotStyles from '../presence/OnlineDot.module.css';

// The small scene at the top of each tour step: a made-up bit of the page the step is about,
// drawn with the app's own tokens. Pictures only (aria-hidden), except "yours", whose swatches
// really change the accent and the theme. On "minimal" motion nothing moves or counts.

// Monday 5 January 2026, for the names of the weekdays
const A_MONDAY = Date.UTC(2026, 0, 5);
const weekdays = (language) => {
    const format = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'narrow', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(A_MONDAY + i * 86400000)));
};

// Something counting on (a timer, a growing plant): `step` every `ms` from `from` to `to`.
// Stays at `to` on minimal motion.
function useCounter(from, to, ms) {
    const still = useMotionLevel() === 'minimal';
    const [value, setValue] = useState(still ? to : from);
    useEffect(() => {
        if (still) return undefined;
        const step = to < from ? -1 : 1;
        const id = setInterval(() => setValue((v) => (v === to ? v : v + step)), ms);
        return () => clearInterval(id);
    }, [from, to, ms, still]);
    return still ? to : value;
}

function Welcome() {
    return (
        <div className={styles.welcome}>
            <span className={styles.halo} />
            <Logo className={styles.logo} />
        </div>
    );
}

// a task (ticks itself off) and an event with its time
function Plan() {
    const { t } = useTranslation();
    return (
        <div className={styles.rows}>
            <div className={`${styles.row} ${styles.rowTicks}`} data-task-color="orange">
                <span className={styles.check}><Icon name="check" size={12} strokeWidth={2.6} /></span>
                <span className={styles.rowText}>
                    <strong>{t('tutDemo_task')}</strong>
                    <small>{t('tutDemo_taskMeta')}</small>
                </span>
            </div>
            <div className={styles.row} data-task-color="blue">
                <span className={styles.eventMark}><Icon name="calendar" size={14} /></span>
                <span className={styles.rowText}>
                    <strong>{t('tutDemo_event')}</strong>
                    <small>{t('tutDemo_eventMeta')}</small>
                </span>
            </div>
        </div>
    );
}

// the focus ring of a 25 minute session, counting down
const SESSION = 25 * 60;
const RING = 2 * Math.PI * 42;
function Focus() {
    const { t } = useTranslation();
    const left = useCounter(18 * 60 + 24, 0, 1000);
    const time = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    return (
        <div className={styles.focus}>
            <svg className={styles.ring} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" className={styles.ringTrack} />
                <circle cx="50" cy="50" r="42" className={styles.ringFill}
                    style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - left / SESSION) }} />
            </svg>
            <span className={styles.ringTime}>
                <strong>{time}</strong>
                <small>{t('tutDemo_focusLeft')}</small>
            </span>
            <span className={styles.focusTask}>{t('tutDemo_task')}</span>
        </div>
    );
}

// one week: an event, two tasks, one of them moving a day on
function Calendar() {
    const { language } = useTranslation();
    const days = weekdays(language);
    const entries = { 0: ['blue'], 2: ['violet', 'move'], 4: ['orange'], 5: ['teal'] };
    return (
        <div className={styles.week}>
            {days.map((day, i) => (
                <div key={i} className={styles.day} data-today={i === 2 || undefined}>
                    <span className={styles.dayName}>{day}</span>
                    {(entries[i] ?? []).filter((e) => e !== 'move').map((color) => (
                        <span key={color} className={`${styles.chip} ${entries[i].includes('move') ? styles.chipMoves : ''}`}
                            data-task-color={color} />
                    ))}
                </div>
            ))}
        </div>
    );
}

// the plant growing through the first levels, beside the streak's flame and an XP bar
function Grow() {
    const { t } = useTranslation();
    const level = useCounter(1, 14, 260);
    return (
        <div className={styles.grow}>
            <LevelPlant level={level} share={0.5} size={104} />
            <div className={styles.growSide}>
                <span className={styles.flame}><Icon name="flame" size={22} strokeWidth={1.6} /><strong>7</strong></span>
                <span className={styles.levelLine}>{fill(t('tutDemo_level'), { level })}</span>
                <span className={styles.xp}><span style={{ transform: `scaleX(${0.2 + (level / 14) * 0.6})` }} /></span>
            </div>
        </div>
    );
}

// friends' faces (two online) and a feed entry with a cheer
const FACES = [['M', 'violet', true], ['J', 'teal', true], ['L', 'orange', false], ['S', 'blue', false]];
function Together() {
    const { t } = useTranslation();
    return (
        <div className={styles.together}>
            <div className={styles.faces}>
                {FACES.map(([letter, color, online]) => (
                    <span key={letter} className={`${styles.face} ${dotStyles.host}`} data-task-color={color}>
                        {letter}{online && <OnlineDot />}
                    </span>
                ))}
            </div>
            <div className={styles.post}>
                <span className={styles.face} data-task-color="violet">M</span>
                <span className={styles.postText}>{t('tutDemo_feed')}</span>
                <span className={styles.cheer}><Icon name="flame" size={14} strokeWidth={1.8} />3</span>
            </div>
        </div>
    );
}

// a week of focus and event time as stacked columns (the statistics' pair of colours)
const WEEK = [[3, 2], [5, 2], [2, 4], [6, 1], [4, 3], [1, 0], [2, 0]];
function Stats() {
    const { t, language } = useTranslation();
    const days = weekdays(language);
    return (
        <div className={styles.stats}>
            <div className={styles.columns}>
                {WEEK.map(([focus, events], i) => (
                    <span key={i} className={styles.column} style={{ '--i': i }}>
                        <span className={styles.stack}>
                            <span className={styles.barEvents} style={{ height: `${events * 11}%` }} />
                            <span className={styles.barFocus} style={{ height: `${focus * 11}%` }} />
                        </span>
                        <span className={styles.dayName}>{days[i]}</span>
                    </span>
                ))}
            </div>
            <span className={styles.legend}>
                <span data-series="focus">{t('tutDemo_focus')}</span>
                <span data-series="events">{t('tutDemo_events')}</span>
            </span>
        </div>
    );
}

const THEMES = [['dark', 'themeDark', 'moon'], ['light', 'themeLight', 'sun'], ['system', 'themeSystem', 'switch']];

// the real thing: accent and theme, changed right away
function Yours() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const accent = useSelector((state) => state.settings.accent);
    const theme = useSelector((state) => state.settings.theme);
    return (
        <div className={styles.yours}>
            <div className={styles.accents} role="group" aria-label={t('accentColor')}>
                {ACCENT_SWATCHES.map(({ value, label, color }) => (
                    <button key={value} type="button" className={styles.swatch} style={{ '--swatch': color }}
                        aria-pressed={accent === value} aria-label={t(label)} title={t(label)}
                        onClick={() => dispatch(setAccent(value))} />
                ))}
            </div>
            <div className={styles.themes} role="group" aria-label={t('appearance')}>
                {THEMES.map(([value, label, icon]) => (
                    <button key={value} type="button" className={styles.theme} aria-pressed={theme === value}
                        onClick={() => dispatch(setTheme(value))}>
                        <Icon name={icon} size={16} />{t(label)}
                    </button>
                ))}
            </div>
            <span className={styles.sample} aria-hidden="true"><span /></span>
        </div>
    );
}

// a sketch of the app with its navigation lit: sidebar, header button, tab bar or tabs on top
function Ready({ nav }) {
    return (
        <div className={styles.device} data-nav={nav}>
            <span className={styles.deviceHeader}><span className={styles.navButton} /></span>
            {nav === 'other' && <span className={styles.navTop}><span /><span /><span /></span>}
            <span className={styles.deviceBody}>
                {nav === 'sidebar' && <span className={styles.navSide}><span /><span /><span /><span /></span>}
                <span className={styles.deviceContent}><span /><span /><span /></span>
            </span>
            {nav === 'phone' && <span className={styles.navBottom}><span /><span /><span /><span /><span /></span>}
        </div>
    );
}

const SCENES = { welcome: Welcome, plan: Plan, focus: Focus, calendar: Calendar, grow: Grow, together: Together, stats: Stats, yours: Yours, ready: Ready };

export default function TourPreview({ id, nav }) {
    const Scene = SCENES[id];
    if (!Scene) return null;
    return (
        <div className={styles.scene} data-scene={id} aria-hidden={id === 'yours' ? undefined : 'true'}>
            <Scene nav={nav} />
        </div>
    );
}
