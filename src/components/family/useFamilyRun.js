import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { familyErrorText } from '../../features/family/family';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';

// run(action, successKey?) dispatches an action (a thunk or a promise-returning call) and shows
// failures as a toast in my language, success optionally too. Resolves to the action's result
// (the family for most changes; true when it had none), or null when it failed.
export function useFamilyRun() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    return useCallback(async (action, successKey) => {
        try {
            const result = typeof action === 'function' ? await dispatch(action) : await action;
            if (successKey) dispatch(showToast(t(successKey), 'success'));
            return result ?? true;
        } catch (err) {
            dispatch(showToast(familyErrorText(t, err), 'error'));
            return null;
        }
    }, [dispatch, t]);
}
