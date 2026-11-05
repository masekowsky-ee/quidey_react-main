# Erinnerungen (testers only) — design

Date: 2026-11-04 · Status: approved in chat

## Goal

Standalone reminders: a text and a time, no task (nothing to tick off in Home's list). No tab of
their own: they live in the existing places. In the Android app a due reminder takes the whole
screen like an alarm clock (screen on over the lock screen, rings + vibrates until "Erledigt" or
"10 min später") plus a notification. Testers only (`requireTester`, `<TesterOnly>`).

## Decisions

- Repeat: once (a point in time) **or** on weekdays at a time (same pattern as routines:
  `days smallint[]` 1 = Monday, `at_time`). No monthly/yearly.
- Android: scheduled **locally** with `AlarmManager.setAlarmClock` (exact, also offline and in
  Doze). The server does not push these to a device that schedules them itself.
- Personal only (no sharing with friends/families), no custom ringtones.

## Backend (`quidey_react-backend`)

Migration `039_reminders.sql`:

- `reminders`: `id serial`, `user_id → users ON DELETE CASCADE`, `text` (1–200), `at timestamptz`
  (once) | `days smallint[]` + `at_time time` (weekly; at least one day), `snoozed_until
  timestamptz`, `done_at timestamptz` (once: done; weekly: never set), `fired_for timestamptz`
  (the occurrence last pushed for), `created_at`, `updated_at`. Check: once XOR weekly. Max 100
  open per account.
- `push_subscriptions.alarms boolean NOT NULL DEFAULT false`: this device rings reminders itself.

Routes (behind `requirePro` + `requireTester`):

- `GET /api/tester/reminders` → open ones + the ones done in the last 7 days (done ones older than
  30 days are deleted). The next time is worked out on the device (`nextOccurrence`).
- `POST /api/tester/reminders { text, at } | { text, days, atTime }`
- `PATCH /api/tester/reminders/:id` (same fields), `DELETE …/:id`
- `POST …/:id/done { occurrence? }` (once: `done_at = now()`; weekly: only clears a snooze),
  `POST …/:id/snooze { minutes 1–120 }` (`snoozed_until = now() + minutes`).
- `PUT /api/tester/reminders/device { endpoint, alarms }` sets `alarms` on that device's row.
- Every change: socket `reminders:changed` to `user:<id>`.

Schedule (in `utils/focus.js`, every few seconds with alarms and routines): `PICK_REMINDERS`
takes reminders whose due time (snooze first, else `at`, else today's weekday + `at_time` in the
owner's time zone) is ≤ now, at most 10 min late, not yet `fired_for` that time, not done, owner
has app access and is a tester; marks `fired_for` in the same statement (SKIP LOCKED); pushes
kind `plan` with `tag reminder-<id>`, `url /inbox?tab=reminders` to every device of the owner
**except** rows with `alarms = true`. No mails, push only.

Tests in `test/api.test.mjs`: create once/weekly, validation, non-tester 403, done/snooze, list
with `next`, the schedule picks once and skips `alarms` devices.

## Frontend (this repo)

- `features/reminders/reminders.js`: slice `reminders` (`items`, `loaded`), thunks
  `fetchReminders`, `addReminder`, `editReminder`, `removeReminder`, `markReminderDone`,
  `snoozeReminder`; `nextOccurrence(reminder, now)` (same rule as the server, local time);
  `useRemindersRealtime` (reload on `reminders:changed`). Loaded app-wide for testers.
- `components/reminders/`:
  - `ReminderList.jsx` — on top of Postfach → Erinnerungen for testers: own reminders (next time,
    weekdays, edit, delete, done), then the tasks' reminders as before.
  - `ReminderForm.jsx` — text, once (date + time) | weekdays + time. Used in a `FormSheet`
    (QuickAdd) and for editing.
  - `ReminderAlert.jsx` — full-screen overlay while the web app is open and one is due (sound
    `reminder`, "Erledigt", "10 min später"); not in the Android app (it rings natively).
- QuickAdd: testers get a switch "Aufgabe | Erinnerung" at the top; Erinnerung shows
  `ReminderForm`. `quickParse` fills date/time from the text.
- Command bar: "Neue Erinnerung" (testers), opens QuickAdd in reminder mode.
- `TEST_FEATURES` gets `reminders`; texts in `i18n/reminderTexts.js`.

## Android (`quidey_android`)

- `features/native/alarms.js` (written here, shared): `syncAlarms(reminders)` hands the coming
  occurrences to the plugin (each `{ id, text, at }` for the next 14 days), `cancelAlarms()` on
  sign-out / account switch, `alarmStatus()` / `openAlarmSettings(which)`, and sends the taps
  done on the alarm (`pendingActions()` → done / snooze to the server → `clearActions(keys)`).
  Built only for the app (`isNativeApp()`); with `alarms` allowed it sets `alarms: true` on this
  device's push subscription.
- Plugin `QuideyAlarms` (`AlarmsPlugin.java`): `schedule({ alarms })` replaces all (stored in
  SharedPreferences, so `BootReceiver` can set them again), `cancelAll()`, `status()` → `{ exact,
  fullScreen, notifications }`, `openSettings({ which })`, `pendingActions()`, `clearActions({ keys })`.
- `AlarmReceiver`: notification on channel `alarm` (high importance, alarm sound category) with
  `setFullScreenIntent(AlarmActivity)` + actions "Erledigt" / "10 min später" (`ActionReceiver`).
- `AlarmActivity`: native, `showWhenLocked` + `turnScreenOn`, big time + text, two buttons. The
  ringing is the notification's (`FLAG_INSISTENT`, alarm sound with `USAGE_ALARM`, vibration);
  after 5 min it is re-posted silent (channel `alarm_quiet`). A choice is stored for
  `pendingActions()`; snooze sets a local alarm in 10 min.
- `BootReceiver`: `BOOT_COMPLETED` → set the stored alarms again.
- Manifest: `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`,
  `WAKE_LOCK`; activity + receivers.
- Settings → App (testers, app only): row "Erinnerungen als Wecker" with what is missing (exact
  alarms, full screen, notifications) and a button to Android's page for it.

## Legal

Privacy policy: reminder texts are stored on the server (like tasks) and are only shown to their
owner; pushes as for tasks.
