import { useEffect, useState } from 'react';
import { read, write } from '../storedSetting';

// small things kept on this device only (localStorage), never sent anywhere
export function useStored(key, fallback) {
    const [value, setValue] = useState(() => read(key, { parse: (text) => JSON.parse(text ?? 'null') ?? fallback, fallback }));
    useEffect(() => { write(key, JSON.stringify(value)); }, [key, value]);
    return [value, setValue];
}
