import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createNote } from '../../features/focus/notebook';
import { playNoise, stopNoise, setNoiseVolume } from '../../features/focus/noise';
import { FOCUS_NOISES, readStoredFocusNoise, storeFocusNoise } from '../../features/settings/preferences';
import { parseQuickEntry } from '../../features/tasks/quickParse';
import { addTask } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './FocusRoom.module.css';

// small things kept on this device only (localStorage), never sent anywhere
function useStored(key, fallback) {
    const [value, setValue] = useState(() => {
        try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
    });
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* only for this visit */ }
    }, [key, value]);
    return [value, setValue];
}

// What this session is for: one sentence, in sight the whole time
export function SessionIntent() {
    const { t } = useTranslation();
    const [intent, setIntent] = useStored('focusIntent', '');
    return (
        <label className={styles.intent}>
            <span className={styles.toolLabel}><Icon name="focus" size={16} /> {t('focusIntentLabel')}</span>
            <input value={intent} maxLength={140} onChange={e => setIntent(e.target.value)} placeholder={t('focusIntentPlaceholder')} />
        </label>
    );
}

// Gedankenparkplatz: a thought that comes up while focusing is parked here instead of followed;
// later it becomes a task or goes
export function ParkingLot() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [items, setItems] = useStored('focusParked', []);
    const [text, setText] = useState('');

    const park = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setItems([...items, { id: Date.now(), text: text.trim() }].slice(-30));
        setText('');
    };
    const toTask = async (item) => {
        const parsed = parseQuickEntry(item.text);
        try {
            await dispatch(addTask(parsed.name, parsed.due, '', parsed.prio, null, undefined, parsed.time ? { due_time: parsed.time } : {}));
            setItems(prev => prev.filter(i => i.id !== item.id));
            dispatch(showToast(fill(t('notePlanned'), { name: parsed.name }), 'success'));
        } catch {
            dispatch(showToast(t('notePlanFailed'), 'error'));
        }
    };

    return (
        <section className={styles.tool} aria-labelledby="parking-title">
            <h3 id="parking-title" className={styles.toolTitle}><Icon name="lightbulb" size={16} /> {t('parkingTitle')}</h3>
            <p className={styles.toolHint}>{t('parkingHint')}</p>
            <form className={styles.inlineForm} onSubmit={park}>
                <input value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder={t('parkingPlaceholder')} aria-label={t('parkingTitle')} />
                <button type="submit" className={styles.smallBtn} disabled={!text.trim()}>{t('parkingAdd')}</button>
            </form>
            {items.length > 0 &&
                <ul className={styles.parked}>
                    {items.map(item =>
                        <li key={item.id}>
                            <span>{item.text}</span>
                            <button type="button" className={styles.textBtn} onClick={() => toTask(item)}>{t('parkingToTask')}</button>
                            <button type="button" className={styles.iconMini} aria-label={t('parkingRemove')} onClick={() => setItems(items.filter(i => i.id !== item.id))}>
                                <Icon name="close" size={14} />
                            </button>
                        </li>)}
                </ul>}
        </section>
    );
}

// Focus sounds: noise to shut the room out (made in the browser, see noise.js)
export function FocusSounds() {
    const { t } = useTranslation();
    const [noise, setNoise] = useState(readStoredFocusNoise);
    const [volume, setVolume] = useStored('focusNoiseVolume', 0.5);
    const [on, setOn] = useState(false);

    // nothing plays by itself (browsers need a click), and it stops when the Fokusraum is left
    useEffect(() => () => stopNoise(), []);

    const pick = (kind) => {
        setNoise(kind);
        storeFocusNoise(kind);
        if (kind === 'off') { stopNoise(); setOn(false); }
        else { playNoise(kind, volume); setOn(true); }
    };

    return (
        <section className={styles.tool} aria-labelledby="sounds-title">
            <h3 id="sounds-title" className={styles.toolTitle}><Icon name={on ? 'sound' : 'soundOff'} size={16} /> {t('soundsTitle')}</h3>
            <div className={styles.chips} role="group" aria-label={t('soundsTitle')}>
                {FOCUS_NOISES.map(kind =>
                    <button key={kind} type="button" aria-pressed={on ? noise === kind : kind === 'off'} onClick={() => pick(kind)}>
                        {t(`sound_${kind}`)}
                    </button>)}
            </div>
            {on &&
                <label className={styles.volume}>
                    <span>{t('soundsVolume')}</span>
                    <input type="range" min="0.05" max="1" step="0.05" value={volume}
                        onChange={e => { const v = Number(e.target.value); setVolume(v); setNoiseVolume(v); }} />
                </label>}
        </section>
    );
}

const METHODS = ['recall', 'feynman', 'spaced', 'interleave', 'blurting'];

// Study methods: one at a time, with what to do in this round
export function StudyMethod() {
    const { t } = useTranslation();
    const [method, setMethod] = useStored('focusMethod', 'recall');
    const current = METHODS.includes(method) ? method : 'recall';
    return (
        <section className={styles.tool} aria-labelledby="method-title">
            <h3 id="method-title" className={styles.toolTitle}><Icon name="brain" size={16} /> {t('methodTitle')}</h3>
            <div className={styles.chips} role="group" aria-label={t('methodTitle')}>
                {METHODS.map(key =>
                    <button key={key} type="button" aria-pressed={current === key} onClick={() => setMethod(key)}>{t(`method_${key}`)}</button>)}
            </div>
            <p className={styles.methodText}>{t(`method_${current}_how`)}</p>
        </section>
    );
}

// After a focus round (in the break): what stuck? Written down, it goes into the notebook as a
// note about the task. Active recall in two minutes.
export function RoundRecap({ focusTask, onSaved }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const { timerMode, pomodoro } = useSelector(state => state.session);
    const [text, setText] = useState('');
    const onBreak = timerMode === 'pomodoro' && pomodoro.phase !== 'focus' && pomodoro.round > 0;
    if (!onBreak) return null;

    const save = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const when = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date());
        try {
            const note = await createNote({
                title: fill(t('recapNoteTitle'), { round: pomodoro.round, task: focusTask?.name ?? t('focusTitle') }),
                body: `${text.trim()}\n\n${when}`,
                taskId: focusTask && !focusTask.shared ? focusTask.id : null,
            });
            setText('');
            dispatch(showToast(t('recapSaved'), 'success'));
            onSaved?.(note);
        } catch {
            dispatch(showToast(t('noteSaveFailed'), 'error'));
        }
    };

    return (
        <form className={styles.recap} onSubmit={save}>
            <h3 className={styles.toolTitle}><Icon name="coffee" size={16} /> {t('recapTitle')}</h3>
            <p className={styles.toolHint}>{t('recapHint')}</p>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={2000} placeholder={t('recapPlaceholder')} aria-label={t('recapTitle')} />
            <button type="submit" className={styles.smallBtn} disabled={!text.trim()}>{t('recapSave')}</button>
        </form>
    );
}
