// Settings → App → Mikrofon: whether Quidey may use the microphone (voice input, features/voice/voice.js)
// and how to allow it once it was blocked. A web page can't open the browser's own settings, so this says
// where they are; "Nochmal fragen" asks again (browsers do that only while it isn't blocked). In the
// Android app "Einstellungen öffnen" leads straight to Android's page for Quidey.

import { useEffect, useState } from 'react';
import { isNativeApp } from '../../features/native/native';
import { microphoneState, askForMicrophone, openVoiceSettings, voiceSupport } from '../../features/voice/voice';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './MicrophoneSettings.module.css';

export default function MicrophoneSettings() {
    const { t } = useTranslation();
    const [state, setState] = useState(null);
    const native = isNativeApp();

    useEffect(() => {
        let live = true;
        microphoneState().then(next => { if (live) setState(next); });
        return () => { live = false; };
    }, []);

    if (!voiceSupport()) return <p className={styles.muted}>{t('micNoSupport')}</p>;

    const ask = async () => setState(await askForMicrophone());
    const text = { granted: 'micGranted', denied: 'micDenied', prompt: 'micPrompt' }[state] ?? 'micUnknown';

    return (
        <div className={styles.box}>
            <p className={styles.state} data-state={state ?? 'unknown'}>
                <Icon name={state === 'granted' ? 'check' : 'mic'} size={16} />
                <span>{t(text)}</span>
            </p>
            {state !== 'granted' && (native
                ? <p className={styles.muted}>{t('micHowApp')}</p>
                : <ul className={styles.how}>
                    <li>{t('micHowChrome')}</li>
                    <li>{t('micHowSafari')}</li>
                    <li>{t('micHowPhone')}</li>
                </ul>)}
            <div className={styles.actions}>
                {state !== 'granted' &&
                    <button type="button" className={styles.button} onClick={ask}>{t('micAskAgain')}</button>}
                {native && state !== 'granted' &&
                    <button type="button" className={styles.button} onClick={openVoiceSettings}>{t('micOpenSettings')}</button>}
            </div>
        </div>
    );
}
