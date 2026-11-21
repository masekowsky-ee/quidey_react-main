// What leaving an account must undo on this device: the one list both ways out use
// (authAction.logout: sign out; accounts.reloadAs: switch to another account / add one).
// The store's slices are reset by rootReducer.js on LOGOUT; this is everything outside the store.
//
//   leaving  - the account is being signed out (not just handed over): its saved reads go, and this
//              device stops getting its push notifications (`token`: the old one, the sign-out
//              removes the stored one right after; `keepPush`: another account takes over, the device
//              stays on and goes over to that one on its start)
//   freezeFocus - the page reloads as another account right after: the focus run is cleared for good
//              (see clearFocusRun, it must be the last thing before the reload)
import { clearFocusRun } from '../session/focusRun';
import { cancelAlarms } from '../native/alarms';
import { setUsageEnabled } from '../usage/usage';
import { forgetReads } from '../offline/offline';
import { forgetPushOnSignOut } from '../pwa/push';

export function teardownAccount({ leaving = false, token = null, keepPush = false, freezeFocus = false } = {}) {
    setUsageEnabled(false);
    if (leaving) {
        // the offline copy of this account's data goes with it (before the token, which names the owner)
        forgetReads().catch(() => {});
        forgetPushOnSignOut(token, keepPush);
    }
    // the reminders' alarm clock (Android app) rings for nobody now; the next account sets its own
    cancelAlarms();
    clearFocusRun({ freeze: freezeFocus });
}
