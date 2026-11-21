import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

// Loads study data once on arrival (again when `key` changes): load(dispatch) returns the
// dispatched requests (false / null entries are skipped, e.g. `!settings && dispatch(...)`).
// A failure stays silent (the screen shows what it has); { loaded, error } is there for who cares.
export function useStudyLoad(load, key) {
    const dispatch = useDispatch();
    const [state, setState] = useState({ loaded: false, error: null });
    useEffect(() => {
        let live = true;
        const requests = load(dispatch).filter(Boolean);
        Promise.all(requests.map(request => Promise.resolve(request)))
            .then(() => live && setState({ loaded: true, error: null }))
            .catch((error) => live && setState({ loaded: false, error }));
        return () => { live = false; };
        // load is read on arrival (and when `key` changes) only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, key]);
    return state;
}
