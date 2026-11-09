import { useId, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './DurationInput.module.css';

// Any length from one second to 23:59:59 (a session is at most a day, the server's limit)
const DURATION_MAX_MS = (24 * 60 * 60 - 1) * 1000;

const partsOf = (ms) => ({
    h: String(Math.floor(ms / 3600000)),
    m: String(Math.floor((ms % 3600000) / 60000)),
    s: String(Math.floor((ms % 60000) / 1000)),
});
const durationOf = ({ h, m, s }) => ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)) * 1000;

// Hours, minutes and seconds typed freely (90 minutes become 1 h 30 once the field is left);
// onChange(ms) for every valid length. presets: minutes offered as one tap.
export default function DurationInput({ ms, onChange, presets = [], label }) {
    const { t } = useTranslation();
    const id = useId();
    const [draft, setDraft] = useState(null);
    const shown = draft ?? partsOf(ms);

    const change = (key, raw) => {
        const next = { ...shown, [key]: raw.replace(/\D/g, '').slice(0, 3) };
        setDraft(next);
        const total = durationOf(next);
        if (total >= 1000 && total <= DURATION_MAX_MS) onChange(total);
    };

    return (
        <fieldset className={styles.field}>
            <legend className={styles.legend}>{label}</legend>
            <div className={styles.parts}>
                {[['h', 'durationHours', 'h'], ['m', 'durationMinutes', 'min'], ['s', 'durationSeconds', 's']].map(([key, name, unit]) =>
                    <label key={key} className={styles.part} htmlFor={`${id}-${key}`}>
                        <input id={`${id}-${key}`} inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={shown[key]}
                            aria-label={t(name)} onChange={e => change(key, e.target.value)} onBlur={() => setDraft(null)}
                            onFocus={e => e.target.select()} />
                        <span aria-hidden="true">{unit}</span>
                    </label>)}
            </div>
            {presets.length > 0 &&
                <div className={styles.presets}>
                    {presets.map(minutes =>
                        <button key={minutes} type="button" aria-pressed={ms === minutes * 60000}
                            onClick={() => { setDraft(null); onChange(minutes * 60000); }}>
                            {minutes}
                        </button>)}
                    <span className={styles.presetUnit}>min</span>
                </div>}
        </fieldset>
    );
}
