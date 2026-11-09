// Speaking instead of typing (branch pro-features): the device's own speech recognition.
// - Browser: the Web Speech API (Chrome, Edge, Safari; the audio goes to the browser maker's
//   service, never to Quidey). Firefox has none: then voiceSupport() is null and no microphone shows.
// - Android app: the app's plugin "QuideyVoice" (VoicePlugin.java in quidey_android, Android's own
//   SpeechRecognizer; the WebView has no Web Speech API). It asks for the microphone itself.
//
// startDictation({ lang, continuous, onText(text, final), onEnd(), onError(code) }) → stop()
// onText gets the whole text of this dictation so far (not only the new words).
// Error codes: 'not-allowed' (no microphone permission), 'no-speech', 'network', 'unavailable', others as given.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../native/native';

const QuideyVoice = registerPlugin('QuideyVoice');

const WebRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

export function voiceSupport() {
    if (isNativeApp()) return Capacitor.isPluginAvailable('QuideyVoice') ? 'native' : null;
    return WebRecognition() ? 'web' : null;
}

export const speechLang = (language) => (language === 'de' ? 'de-DE' : 'en-US');

function startWeb({ lang, continuous, onText, onEnd, onError }) {
    const Recognition = WebRecognition();
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = Boolean(continuous);
    rec.maxAlternatives = 1;
    let ended = false;
    rec.onresult = (event) => {
        let text = '';
        let final = true;
        for (const result of event.results) {
            text += `${result[0].transcript} `;
            final = Boolean(result.isFinal);
        }
        onText(text.replace(/\s+/g, ' ').trim(), final);
    };
    rec.onerror = (event) => onError?.(event.error === 'service-not-allowed' ? 'not-allowed' : event.error);
    rec.onend = () => { if (!ended) { ended = true; onEnd?.(); } };
    rec.start();
    return () => { try { rec.stop(); } catch { /* already over */ } };
}

function startNative({ lang, continuous, onText, onEnd, onError }) {
    const handles = [
        QuideyVoice.addListener('partial', ({ text }) => onText(text ?? '', false)),
        QuideyVoice.addListener('final', ({ text }) => onText(text ?? '', true)),
        QuideyVoice.addListener('error', ({ code }) => onError?.(code ?? 'unavailable')),
        QuideyVoice.addListener('end', () => { cleanup(); onEnd?.(); }),
    ];
    let cleaned = false;
    function cleanup() {
        if (cleaned) return;
        cleaned = true;
        handles.forEach(handle => Promise.resolve(handle).then(h => h?.remove?.()).catch(() => {}));
    }
    QuideyVoice.start({ language: lang, continuous: Boolean(continuous) }).catch((err) => {
        onError?.(err?.code === 'NOT_ALLOWED' || /permission/i.test(err?.message ?? '') ? 'not-allowed' : 'unavailable');
        cleanup();
        onEnd?.();
    });
    return () => { QuideyVoice.stop().catch(() => {}); };
}

export function startDictation(options) {
    const support = voiceSupport();
    if (support === 'native') return startNative(options);
    if (support === 'web') return startWeb(options);
    options.onError?.('unavailable');
    options.onEnd?.();
    return () => {};
}
