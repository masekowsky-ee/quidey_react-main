// A microphone button: tap, speak, tap again (or pause) to stop (features/voice/voice.js).
// onText(text, final) gets what was said so far in this dictation; continuous keeps listening
// through pauses (dictating into a note). Not shown where speech can't be recognised.

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { voiceSupport, startDictation, speechLang } from '../../features/voice/voice';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './MicButton.module.css';

export default function MicButton({ onText, continuous = false, className = '', size = 16, onListening }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const [listening, setListening] = useState(false);
    const stop = useRef(null);
    const calls = useRef({ onText, onListening });
    useEffect(() => { calls.current = { onText, onListening }; });
    useEffect(() => () => stop.current?.(), []);

    if (!voiceSupport()) return null;

    const setOn = (on) => { setListening(on); calls.current.onListening?.(on); };
    const toggle = () => {
        if (listening) { stop.current?.(); return; }
        setOn(true);
        stop.current = startDictation({
            lang: speechLang(language),
            continuous,
            onText: (text, final) => calls.current.onText(text, final),
            onEnd: () => { stop.current = null; setOn(false); },
            onError: (code) => {
                if (code === 'no-speech' || code === 'aborted') return;
                dispatch(showToast(t(code === 'not-allowed' ? 'voiceNotAllowed' : 'voiceFailed'), 'error'));
            },
        });
    };

    return (
        <button type="button" className={`${styles.mic} ${className}`} onClick={toggle} aria-pressed={listening}
            aria-label={t('voiceSpeak')} title={listening ? t('voiceStop') : t('voiceSpeak')} data-listening={listening || undefined}>
            <Icon name="mic" size={size} />
        </button>
    );
}
