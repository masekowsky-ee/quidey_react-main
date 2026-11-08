// One call site per thing that happens: the Firebase side (Android app, own consent) and the
// Quidey statistics (own consent) each decide for themselves whether to count it.
import { trackScreen, trackEvent, screenName } from '../native/analytics';
import { track } from './usage';

export function trackView(pathname) {
    trackScreen(pathname);
    track(`view:${screenName(pathname)}`);
}

// params go to Firebase only. Names the server counts itself (task_created, task_done) or that
// are no statistics (focus_end) are dropped by track(). Only for actions privacy § 3 lists for
// Firebase; Quidey-only actions (note_written, routine_run, study_plan_applied, reminder_created)
// call track() from usage.js directly.
export function trackAction(name, params) {
    trackEvent(name, params);
    track(name);
}
