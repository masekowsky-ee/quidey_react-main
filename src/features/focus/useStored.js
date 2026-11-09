import { useEffect, useState } from 'react';

// small things kept on this device only (localStorage), never sent anywhere
export function useStored(key, fallback) {
    const [value, setValue] = useState(() => {
        try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
    });
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* only for this visit */ }
    }, [key, value]);
    return [value, setValue];
}
