// A microphone button: tap, speak, tap again (or pause) to stop (features/voice/voice.js).
// onText(text, final) gets what was said so far in this dictation; continuous keeps listening
// through pauses (dictating into a note). Not shown where speech can't be recognised.

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { voiceSupport, startDictation, speechLang, openVoiceSettings } from '../../features/voice/voice';
import { isNativeApp } from '../../features/native/native';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './MicButton.module.css';

export default function MicButton({ onText, continuous = false, className = '', size = 16, onListening }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
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
                if (code !== 'not-allowed') { dispatch(showToast(t('voiceFailed'), 'error')); return; }
                // blocked: one tap to where it can be allowed (the app: Android's page; the browser: how to)
                dispatch(showToast(t('voiceNotAllowed'), 'error', {
                    action: { label: t('voiceAllow'), run: () => (isNativeApp() ? openVoiceSettings() : navigate('/settings#microphone')) },
                }));
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
