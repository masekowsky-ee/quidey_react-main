import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiFetch } from '../helperFunction';

// The device's time zone ("Europe/Berlin"), or undefined when the browser doesn't say
export function deviceTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
        return undefined;
    }
}

// Tells the server my time zone and language, so reminder mails come at the right local time
// and in my language: once when the app opens (signed in) and again when the language changes.
// Fails quietly; the next start tries again.
export function useAccountLocale(enabled = true) {
    const language = useSelector(state => state.settings.language);

    useEffect(() => {
        if (!enabled) return;
        apiFetch('/api/users/locale', {
            method: 'PUT',
            body: JSON.stringify({ timezone: deviceTimezone(), language }),
        }).catch(() => {});
    }, [enabled, language]);
}
