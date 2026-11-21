import { useState } from 'react';
import { useStudyError } from './studyUi';

// What a sheet's save does around its request: busy while it runs, its failure as a sentence in
// `error` (mapError(err, errorText) for a code of its own). On success busy stays on: the sheet
// is closing. setError also takes the sheet's own checks ("name missing").
//   const { run, busy, error, setError } = useSubmit(async (change) => { await ...; close(); });
export function useSubmit(fn, mapError) {
    const errorText = useStudyError();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const run = async (...args) => {
        setBusy(true);
        setError(null);
        try {
            await fn(...args);
        } catch (err) {
            setError(mapError ? mapError(err, errorText) : errorText(err));
            setBusy(false);
        }
    };
    return { run, busy, error, setError };
}
