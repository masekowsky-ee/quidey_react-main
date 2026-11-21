// Speech OUTPUT (Quidey Max): the device's own speech synthesis reads text aloud (the assistant's
// answers, Home's "Vorlesen"). Input is voice.js; the language is the same, speechLang(language).
//
// speechOutputSupport() → boolean
// speak(text, { lang, onEnd }) → stop(). Earlier speech is cancelled first (its onEnd fires).
//   onEnd fires once: at the end, on an error, on stop(), and when a newer speak() takes over.
// stopSpeaking() stops whatever this module is saying. Speech also stops when the app is hidden.
//
// A voice of the language is picked when there is one, one on the device first. Voices can load late (Chrome): when none
// are listed yet, speaking waits for `voiceschanged` (at most VOICES_WAIT_MS), else the engine chooses.

const VOICES_WAIT_MS = 500;

export function speechOutputSupport() {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';
}

const normal = (lang) => String(lang ?? '').replace('_', '-').toLowerCase();

// A voice on the device (localService) before a network voice, which some browsers send the text to
// (privacy § 5 says so): the language and region, then the language, first among the local voices,
// then among all.
function voiceFor(synth, lang) {
    const voices = synth.getVoices?.() ?? [];
    const want = normal(lang);
    const base = want.split('-')[0];
    const exact = (voice) => normal(voice.lang) === want;
    const sameLanguage = (voice) => normal(voice.lang).split('-')[0] === base;
    const local = voices.filter(voice => voice.localService === true);
    return local.find(exact) ?? local.find(sameLanguage) ?? voices.find(exact) ?? voices.find(sameLanguage) ?? null;
}

let current = null;

export function stopSpeaking() {
    current?.();
}

export function speak(text, { lang, onEnd } = {}) {
    if (!speechOutputSupport()) {
        onEnd?.();
        return () => {};
    }
    const synth = window.speechSynthesis;
    stopSpeaking();
    try { synth.cancel(); } catch { /* nothing to cancel */ }

    let finished = false;
    let waiting = null;
    let timer = null;
    let utterance = null;

    const onHidden = () => { if (document.visibilityState === 'hidden') stop(); };
    const unwait = () => {
        if (waiting) synth.removeEventListener?.('voiceschanged', waiting);
        waiting = null;
        clearTimeout(timer);
    };
    function finish() {
        if (finished) return;
        finished = true;
        unwait();
        document.removeEventListener('visibilitychange', onHidden);
        if (current === stop) current = null;
        onEnd?.();
    }
    function stop() {
        if (finished) return;
        // the engine's own "end" event comes later (or never): ours is the one that counts
        if (utterance) { utterance.onend = null; utterance.onerror = null; }
        try { synth.cancel(); } catch { /* already quiet */ }
        finish();
    }
    function start() {
        unwait();
        if (finished) return;
        utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        const voice = voiceFor(synth, lang);
        if (voice) utterance.voice = voice;
        utterance.onend = finish;
        utterance.onerror = finish;
        try { synth.speak(utterance); } catch { finish(); }
    }

    current = stop;
    document.addEventListener('visibilitychange', onHidden);
    if ((synth.getVoices?.() ?? []).length === 0 && synth.addEventListener) {
        waiting = start;
        synth.addEventListener('voiceschanged', waiting);
        timer = setTimeout(start, VOICES_WAIT_MS);
    } else {
        start();
    }
    return stop;
}
