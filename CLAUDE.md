# Quidey — project overview

Quidey is a planner for learning and studying ("Planer für Lernen und Studium"): tasks, a focus timer, a calendar, and friends you study
with live. German-first (de default, en available), currently a **closed beta** — only users
with `is_pro` or `is_tester` (admins always) get into the app. The app runs on **app.quidey.com**;
the public landing page on **quidey.com** is a separate static site (repo `quidey_landing`).

Four repositories, side by side on this machine in `C:\Users\eesge\Quidey\`:

| Repo | Path | GitHub |
|---|---|---|
| Frontend (this one) | `C:\Users\eesge\Quidey\quidey_react-main` | masekowsky-ee/quidey_react-main |
| Android app (Capacitor; a clone of this repo + `android/`) | `C:\Users\eesge\Quidey\quidey_android` | not on GitHub yet |
| Backend | `C:\Users\eesge\Quidey\quidey_react-backend` | masekowsky-ee/quidey_react-backend |
| Landing page (Astro, static) | `C:\Users\eesge\Quidey\quidey_landing` | not on GitHub yet |

Everything for the app is written here first; the Android repo takes it over with
`git pull web <branch>` and only adds what is truly Android (see "Android app" below).

`README.md` is still the untouched Vite template; this file is the real description.

## Frontend stack

- React 19 + Vite 8, plain JavaScript (no TypeScript), CSS Modules (most modules
  `composes:` shared classes from `src/components/ui.module.css`), Inter via `@fontsource-variable`.
- State: Redux (`configureStore` + classic reducers/action types + thunks), slices in
  `src/features/rootReducer.js`: `task`, `session`, `auth`, `settings`, `friends`, `together`,
  `toast`, `inbox`, `news`, `family`, `feed`, `progress`, `presence` (who is online: user id →
  bool, `src/features/presence/presence.js`).
- Routing: react-router-dom 7 (`BrowserRouter` in `src/main.jsx`).
- Animation: `motion` (Framer Motion) with three user-chosen levels `minimal | normal | extreme`
  (`src/features/settings/motion.js`, `MOTION` presets, confetti `burst`). Remotion
  (`@remotion/player`) renders the intro (`src/components/intro/`, only when the app is opened
  fresh on `/`: not on reload, back/forward or a deep link).
- Interaction & material rules (Apple's fluid-interface guidelines, for the app's own look):
  springs are `spring(response, dampingRatio)` from motion.js (damping 1 = no overshoot, the
  default; bounce only on `extreme` or after a flick); CSS uses `--spring-curve` /
  `--spring-bounce` (`linear()` samples of the same springs) via `--ease`, `--ease-slow`, and
  `--press` for presses, which land on pointer-down. `minimal` = the reduced-motion rendition
  (cross-fades only), and the system's reduce-motion always cross-fades dialogs. Every
  dialog and form card uses `useSheet(onClose, ref?, open?)` (`features/layout/dragDismiss.js`:
  `backdrop` / `panel` props, `<SheetGrabber />` first, `data-sheet-drag` on its head; form
  cards via `FormSheet` in QuickAdd.jsx): it slides in (a short rise; on phones a bottom sheet
  from the edge that can be pulled down: 1:1, rubber band, velocity projected, interruptible),
  and `sheet.dismiss(then?)` (cross, Escape, Cancel, a click beside it, after saving) takes it
  back the same way before closing. A field a sheet opens to (new task, routine, the calendar's
  add field) takes the focus through `useFocusOnArrival(ref)` / `focusOnArrival(el)`, never
  `autoFocus`: at once with a mouse, on touch only after the slide-in (the on-screen keyboard
  shrinks the window and the sheet would jump mid-way). Behind it the page is dimmed and slightly blurred
  (`--scrim-blur`, on the backdrop's `::before`; `data-scrim` / `data-scrim-layer` for
  backdrops that aren't sheets). Other dialogs (popovers, command bar) materialise (scale +
  blur). The drawer menu is pushed closed the same way
  (`useDragDismiss`, axis x). Header and tab bar are translucent (`--material-bar`, blur on a
  `::before`, only without `data-ui`), the header's hairline appears once content scrolls under
  it; reduce transparency / more contrast make them solid. Type: Inter with its opsz axis,
  `--type-*` / `--track-*` (tighter tracking as size grows). Haptics ride on `playSound` for the
  big moments (`HAPTICS` in sound.js), theme changes cross-fade (View Transitions).
- Sound: `src/features/settings/sound.js`, synthesised with the Web Audio API (no files), one
  voice (sine bell + octave + glassy tine, a short echo, A major pentatonic, motif E → A).
  `playSound(name)` (`SOUND_NAMES`: done, undo, focusStart, pause, focusEnd, challenge, streak,
  milestone, levelUp, message, notify, reminder, cheer, error); levels `off | soft | full`
  (`settings.sound`, `setSound`, Settings → Darstellung → Töne with a "Probehören" row). Silent
  in a background tab and before the first click; error toasts play `error` by themselves.
- Realtime: `socket.io-client` (`src/features/realtime/socket.js`, `useRealtime(event, handler)`),
  loaded with a dynamic import only once signed in.
- Icons: one outline set, `src/components/icons.jsx` (`<Icon name size? />`, 24px grid, 1.7
  stroke); the calendar keeps its own `calendar/icons.jsx`. No icon files in `src/assets/`.
- Code splitting: every page except Home is `lazy()` in `App.jsx` (`PAGES`), preloaded when the
  app is idle (`preloadPages`); `LegalFooter` lives in its own file so the legal texts stay
  lazy. `vite.config.js` puts react / router / state / motion in their own long-cached chunks.
- Loading = skeletons, never a blank or "Lädt…" screen (`src/components/skeleton/`): `Bone`
  (grey shape; `round`, `pill`), `Skeleton` (aria-busy wrapper, one "Lädt…" status, `inert`,
  `fade`), `SkeletonRows`. A page's shape uses its real layout: labels known up front (titles,
  tabs, today's date, this month's grid) are text, data is grey. `PageSkeletons.jsx`:
  `RouteSkeleton` (the Suspense fallback per address: Home, calendar, Gemeinschaft, inbox,
  stats, profiles, settings, else a column; own CSS, the pages' styles aren't loaded yet) and
  `GateSkeleton` (sign-in). Parts that load their own data draw their skeleton beside
  themselves (`TaskRowSkeleton`, `MomentumSkeleton`, week strip / group chips / title line while
  `selectTasksLoaded` is false, i.e. `task.loaded` before `SET_TASK_STATE`). First paint before
  any JS: `index.html` carries a skeleton in `#root` styled by `public/boot.css` (theme colours
  copied from `index.css`, a test compares them; classes only, the CSP forbids style
  attributes); `theme-init.js` picks it via `<html data-boot="home|page|gate">`.
- i18n: `src/i18n/translations.js` (de/en dictionaries) + `useTranslation()` → `t(key)`. The language
  is the one picked in Settings (localStorage `language`), else the device's: German on a German
  device, English on every other (`deviceLanguage()` in preferences.js, the same rule in
  `public/theme-init.js` for `<html lang>`; App keeps `<html lang>` in step). Tests run on a German
  "device" (setupTests.js).
- Tests: Vitest + jsdom + Testing Library, all in `src/__tests__/` (`npm test`).
  Lint: ESLint 10 flat config (`npm run lint`).

## How the app is gated (`src/App.jsx`)

Order of checks on every render:
1. `/verify-email` → `VerifyEmail` (works signed in or out).
2. Legal paths (`/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/kontakt`, see
   `src/legal/paths.js`) → `LegalPage`, always public.
3. Not signed in → `SignIn` (wordmark, link back to the landing page, the `Profile` sign-in /
   sign-up card, legal footer). `/signup` opens on sign-up; the landing page's email line hands
   the address over as `#email=…` (read once, then removed from the URL). Signed in, `/signin`
   and `/signup` redirect to `/`. `LANDING_URL` in `src/features/site.js`.
4. Signed in, access not checked yet → `AppSkeleton` (the real `Header`/`Menu`/`TabBar`, inert,
   and the address's `RouteSkeleton`; after 5 s a bar "Verbindung…" + retry / sign out); not pro → `/beta` (`BetaGate`, user can
   request beta access; three ways on: the form, "Zur Startseite" (`LANDING_URL`) and "Ab in den Warteraum" →
   `/arcade` with `ArcadePage waiting`, the only other route there, which re-checks access every 60 s so the app
   opens by itself once let in).
5. Pro → full app in the frame `AppShell.module.css`: `Header`, `Menu`, `TabBar`, `Toaster`,
   `Tutorial`, animated page routes in `<main>`. Widths (`src/features/layout/breakpoints.js`,
   `useMediaQuery`): ≥1100px the `Menu` is a fixed sidebar and the header starts beside it;
   721–1099px the menu is a drawer behind the header's button; ≤720px a bottom `TabBar` (Start,
   Kalender, Fokus, Sozial, Mehr → drawer; equal columns edge to edge, the current tab marked by a
   neutral pill behind a bolder icon that slides between tabs, layoutId, only "Mehr" while the menu is
   open) replaces the header's button. The shell sets
   `--sidebar-w`, `--tabbar-h` and `--page-gutter`; fixed parts (toasts, timer button) and every
   page container use them. The closed drawer is `inert`; `setShowMenu(true|false)` (no argument
   toggles). Menu (Hick's law: few choices at once): Start, Kalender, Gemeinschaft, Postfach,
   Statistiken (one list, no "Mehr" heading), at the bottom Admin/Einstellungen/Feedback and the
   `AccountSwitcher` (profile, switch account, add account, sign out). Under Gemeinschaft a row of
   the friends online right now (faces + "N Freunde online", `useOnlineFriends`); the tab bar puts
   a green dot on Gemeinschaft while any friend is online. The tour ("Einführung", `Tutorial.jsx`)
   opens by itself only for a new account (`access.tourSeen` from `/api/me` = `users.tour_seen_at`;
   migration 031 set it for every account that existed; closing calls `markTourSeen` →
   `PUT /api/users/tour-seen`, so no device shows it again) and any time from Settings → App: 9 chapters (welcome, plan,
   focus, calendar, grow, together, stats, yours, ready), each with a small animated scene
   (`tour/TourPreview.jsx`; "yours" really switches accent/theme, "ready" shows where the nav is
   at this width) and one way out (open the page / new-task form); texts in `i18n/tourTexts.js`.
   Onboarding of a new account (`features/onboarding/onboarding.js`, dialogs
   `components/onboarding/OnboardingPrompts.jsx`, one at a time, never while the push question is
   open): closing that first tour without picking a way out asks "Was möchtest du als Erstes
   machen?" (first task, friends, shared session, calendar, profile, or look around). Thunks call
   `noteAction(kind)` (task created / ticked off, group, friend request, friend, shared session,
   family); from the 3rd it asks once to install Quidey (only where `installState()` is `prompt` or
   `ios`; yes → `/settings#app`); the first success (`done`, `friend`) after 10 asks "Gefällt dir
   Quidey?" (yes → 1–5 stars + optional words, "Nicht wirklich" → what could be better; sent as
   feedback category `rating`). Counted per device in localStorage `onboarding:<username>`.
   Yes/no questions use `btnYes` (lifted primary with an icon) / `btnNo` (grey) from
   `ui.module.css` (also `PushOffer`). The header has a streak pill (flame + days, filled once today counts). The active entry is
   brighter ink, no fill; count badges are neutral (the accent stays on data, never on nav,
   tabs or buttons; one filled inverted primary per screen). The header ends with the inbox (unread
   count as badge, every width). The round add button at the bottom right (`home/AddFab.jsx`,
   rendered by App on Start, Kalender, Fokusraum, `/family/:id`, `/together/:id` and the Sozial tabs
   Sitzungen / Family: `features/layout/addFab.js`, `main[data-fab]` keeps room under it; Home's folded
   timer has the same shape bottom left, `.fab` in ui.module.css, only the colours differ) opens the
   new-task form over any page (`QuickAdd`, `settings.showForms` via `showForms(true|false)`).
   Its name field takes a day, time and priority written into it ("Essay morgen 14 Uhr !hoch",
   German and English, `features/tasks/quickParse.js`): a line under the name says what was
   found, saving fills the still-empty fields with it and keeps only the rest as the name;
   "Ignorieren" keeps the name as typed.
   Row actions in lists appear on hover/focus with a mouse (always on touch).
   Quick ways through the app, for everybody: the command bar (`variants/CommandPalette.jsx`,
   Ctrl/⌘ K, "/" or the header's search button, a cross or Escape closes it; finds my open tasks
   and opens their editor, jumps to places, new task, light/dark, shortcuts; once something is
   typed also every named tab, calendar view, setting and profile section with where it sits
   (`features/search/places.js`) and the tour / "Profil gestalten"; variants and `/tester` only
   for testers). A section's id in the hash (`/settings#appearance`, `/profile#password`) is
   scrolled to by `useHashTarget` (`features/layout/hashTarget.js`), also when only the hash
   changes; Settings opens the section's area (`SECTION_AREAS`), `/profile#customize` the editor
   and keyboard shortcuts (`features/shortcuts/shortcuts.js`, overview `ShortcutsDialog.jsx` on
   "?": N new task, G then H/K/G/P/S to Start/Kalender/Gemeinschaft/Postfach/Statistiken; never
   while typing or with a dialog open). Ticking off a task on Home shows a toast with
   "Rückgängig" for 6 s (`showToast(…, { action: { label, run } })`, not for repeating tasks).
   The streak's colour is `--streak-ink` (default `--plant-fruit`; variants set their own ink).

Online status: the backend counts each user's open sockets (`realtime.js`, in memory, never
stored, 8 s grace on disconnect) and tells friends + people in open shared sessions/families
`presence:changed { userId, online }`; lists carry `online` (friends, session people, family
people, profiles of friends, ranking). Hidden for everybody with `users.show_online = false`
(profile editor: "Zeigen, wenn ich online bin"). Frontend: `presence` slice, `usePresenceRealtime`
in App, `useOnline(id, fallback)`, `<Avatar presence>` / `<ProfileAvatar presence>` draw the green
dot (`components/presence/OnlineDot.jsx`, `--online`). App loads the friends list app-wide.

App also: re-checks access on a `PRO_REQUIRED` API error or a refused socket
(`REALTIME_REJECTED`); signs out on `TOKEN_REVOKED`/`TOKEN_INVALID`; opens the Socket.IO
connection while allowed and reloads lists on its signals (`useLiveLists`, `useInboxRealtime`,
debounced via `useRealtimeRefresh`). Polling is only a safety net (`useSafetyPoll`): every 60 s
(an open shared session 30 s) and on focus while the socket is down, but only every 5 min (60 s)
while it's connected. The stopwatch reports every 30 s (`REPORT_EVERY_MS`); others' running
time is counted on locally (`othersRunningMs`). Runs task reminders
(`src/features/tasks/reminders.js`) and the team stopwatch reporter (`useWorkReporter`).

## Pages / features

- `/` Home — layout `solo` or `team` (`TeamHome`), switchable in settings. Solo (`Home.jsx`):
  title row (today's date as h1, open / due today / overdue, Solo|Team switch), the motivation
  strip (`home/Momentum.jsx`: streak with the last 7 days, today's state and next milestone; today's
  daily challenges + level plant; friends online and friends' streaks; a swipe row on phones), next 8 days
  (`WeekDaysContainer`), group filter chips (`GroupBtnContainer`: "Alle", groups, session groups,
  "+"), the list (`TaskContainer`, one `task/TaskRow` per task: check, name (click renames), one
  line of details, day as "Heute/Morgen/weekday" (`dueText`), priority as "Hoch/Mittel", focus /
  edit / two-step delete (`ConfirmDeleteButton`)), and the "Fokus" column (`WorkingContainer` +
  `TimerContainer inline`) sticky beside the list from 1100px; narrower, the focus card comes
  first and the timer is the corner button (bottom left; the add button bottom right). Colour, groups, description and priority are set in
  the editor (`TaskEditDialog`); a shown group's colour and deletion sit in the list's title row.
  Tasks of shared sessions can be taken out of "Alle" (`settings.showSharedTasks`, eye button in
  the list's title row and in Settings); a session's own group always shows them. While a
  session's group is shown, the new-task form (opened on `/`) creates the task in that session
  (`addSharedTask`, only the session's fields; a line says where it goes); elsewhere it stays mine.
  Every task row has a tooltip "Erstellt am … um … von …" and the editor (`TaskEditor`) the same
  line under its fields (`features/tasks/created.js`: own tasks `created_at` + `owner`, session /
  family entries `createdAt` + `addedBy`; compared with my username).
- **Profile pictures — for everybody** (testers only until 2026-11-04; `features/profile/avatars.js`,
  `profile/AvatarUpload.jsx` in "Profil gestalten"): the picked file opens `AvatarCropper.jsx` (a sheet: the picture
  under a round window, drag / arrow keys to move, slider / wheel / pinch to zoom, `clampPlacement` keeps the circle
  covered, `cropSquare`), `circlePicture` cuts that circle out in the browser (corners transparent, WebP else PNG,
  ≤ 110 KB, metadata dropped), `PUT /api/profile/avatar` (`/api/tester/avatar` still answers testers),
  `DELETE /api/profile/avatar`, admins `DELETE /api/admin/users/:id/avatar` (users list "Profilbild entfernen",
  `hasAvatar`). `useAvatarUrl(userId)` batches `GET /api/avatars?ids=` (→ { id: version }, only people who also see
  my online status), then loads `/api/avatars/:id?v=` with the token into an object URL; `avatars:changed` (live,
  `useAvatarRealtime` in App) forgets one. `ProfileAvatar` and `together/Avatar` show it instead of emoji / initials.
  `access.userId` = my id.
- **Admin → Tester-Feedback → "Gerade im Test"**: what is live for testers, from `TEST_FEATURES`
  (`testerOnly`, `since`) and the interface variants, with the ratings so far.
- **Focus timer** (one for the whole app): `state.session` holds `timerMode` (`timer | pomodoro | stopwatch`),
  `timer` {time, active}, `runningSince` (wall-clock ms the running time is counted from), `pomodoro`
  {phase focus|short|long, round, config from localStorage `pomodoro`}, `focusTask` (+ `focusPicked`) and the
  current session. `useFocusClock` (`features/session/useFocusClock.js`, mounted in App and in the timer panel,
  only one counts) never counts ticks: every 250 ms and on visibilitychange/focus/pageshow it moves the timer by
  the whole seconds since `runningSince` (CLOCK_TICK books them on `selectFocusTask` and the total), so a
  phone that froze the app loses nothing. A countdown that ran out ends then (`countdownEnded`: sound, session
  saved, next Pomodoro phase ready, toast). The run is kept in localStorage `focusRun` (`focusRun.js`, 18 h,
  cleared on sign-out / account switch) and taken up on the next start. Controls are thunks (`startFocus`,
  `pauseFocus`, `stopFocus`, `skipPhase`); start sets `PUT /api/focus/alarm` {endsAt, phase}, pause/stop
  `DELETE`: the server pushes the end (kind `plan`) even with the phone off. The header's chip links to /focus.
  Stop and pause first book the seconds since the last tick (`catchUpClock`, also what useFocusClock runs). A
  session is dated when its time starts (SET_TIMER with nothing booked sets `currentSessionData.date`): the empty
  one made after the last save, kept overnight in focusRun, used to put the day's first session on the day
  before. Start on a countdown that is over (or stopped) runs the last length again (`sessionParams.time`, a
  Pomodoro phase's length): the button says "Nochmal". Lengths are typed freely: the countdown in h / min / s
  (`focus/DurationInput.jsx`, 1 s – 23:59:59, quick lengths beside it; the corner timer's editor fields take
  typing too), Pomodoro lengths as numbers within `POMODORO_LIMITS` (preferences.js). While a session is on
  (started, or paused mid-way) a lasting notification shows it (`features/session/focusNotification.js`,
  `useFocusNotification` in App, written anew only when what it shows changes): in the Android app the plugin
  `QuideyFocusNotification` (`FocusNotificationPlugin.java` in quidey_android: ongoing, silent channel "focus",
  Android's chronometer counting to the end / up from the start, gone by itself at the end); in the browser a
  service-worker notification (tag `quidey-focus`, "Endet um …" / "Läuft seit …", a tap opens /focus), only where
  notifications are already allowed. In the browser the running timer also stands in the tab's title ("▶ 24:13 ·
  Essay", `features/session/focusTitle.js`, `useFocusTitle` in App; worked out from `runningSince`, the beat from the
  worker `titleTick.worker.js`, since a background tab slows the page's own timers; not while the team stopwatch has it).
- `/focus` — **Fokusraum** (`components/focus/`): big ring timer (`FocusTimer`, mode switch, Pomodoro lengths),
  session goal, task in focus (pick / done), recap after a Pomodoro (into the notebook), thought parking lot
  (→ task via `parseQuickEntry`), focus sounds (`features/focus/noise.js`, Web Audio brown/pink/rain), study
  methods, full screen (only in a browser tab, `runsInBrowser()` in install.js: not in the Android app or the
  installed web app; testers: the timer folds into a sticky bar on start, `MiniTimer` in `FocusTimer.jsx`,
  "Groß zeigen" opens it, big again once nothing runs); the **notebook** beside it (`Notebook.jsx`, `features/focus/notebook.js`, API
  `/api/notebook`; the server reads its bigger bodies only after sign-in, checks pictures by their
  magic bytes and keeps all pictures of an account under 25 MB, `NOTEBOOK_STORAGE_FULL`): notes with `- [ ]` checklists, `# ` headings, link and picture attachments (pictures shrunk
  in the browser, at most 4 per note), "plan as task" for the cursor's line, autosave. The editor is
  `components/notes/NoteEditor.jsx` (shared with `/notes`; `full` = testers' extras). Writing keeps a live preview of
  how it reads beside the text (under it when narrow, container query in Notes.module.css); every list row shows a
  preview line (`notePreview`, `notes/NotePreview.jsx`: the text after the title line, else "only attachments (n)" /
  "nothing written yet"). "An Board heften" (`board/PinToBoards.jsx`) pins it to a family's / open session's board.
- `/notes` — **Notizen**, testers only (`components/notes/NotesPage.jsx`, `features/notes/notes.js`): the
  notebook's notes in views (all, pinned, folders, tags, archive, trash; `?view=folder:<id>|tag:<word>|…`,
  `?note=<id>`), search (words, `#tag`), sort + list/tiles (localStorage `notesSort`, `notesLayout`),
  templates (`NOTE_TEMPLATES`, texts `noteTpl_*`), folders (`/api/tester/note-folders`), tags, colour,
  archive, trash (30 days, `GET /api/notebook?trash=1`, `DELETE /api/tester/notebook/trash`), duplicate,
  Markdown export, rich text (`noteLines(body, rich)`: `## `, lists that go on with Enter, `1. `, `> `,
  `---`, `**bold**`, `` `code` ``). The server takes folderId/tags/color/archived/trashed only from testers
  (`TESTER_REQUIRED`); `GET /api/notebook` leaves the trash out for everybody. Migration 036.
- `/collections`, `/collections/:id` — **Sammlungen**, testers only (`components/collections/`, slice
  `collections` in `features/collections/collections.js`, API `/api/tester/collections`): tasks, events and
  notes together (`collection_items`, gone with their task/note). Put in from the collection (search or
  make new) or from the other side: `CollectionPicker` in `TaskEditor` (own tasks/events) and the notes'
  editor ("Neue Sammlung damit" names it after the thing). Texts of notes + collections in `i18n/notesTexts.js`.
  **For testers collections replace groups** (`useTaskGroups()`, `asGroup` in collections.js: a collection goes
  around as `{ id: 'collection-<id>', collection: true, collectionId, … }`): Home's chips ("+" makes one,
  `GroupForm`), the list of the shown one (its colour, its page, delete, take a task out), a task's labels,
  the new-task form and the calendar's quick add put new ones into the shown one (`addToShownCollection`), the
  calendar's filter (`filterTasks(…, { inGroup })`) and .ics, the departure board, and "Fokus nach Sammlung" on
  /stats (`GET /api/stats` → `collections`, testers only, focus booked on their tasks). The group picker is
  hidden for them (the editor has `CollectionPicker`). Their first `GET /api/tester/collections` takes their
  groups over once (`users.groups_imported_at`; same name, colour, description, tasks; not a group whose name a
  collection has already); the groups themselves stay for when the test ends. Profile "top groups" still
  come from groups. Session / family sub-groups are separate and unchanged.
- `/study`, `/study/:subjectId`, `/study/goals/:id` — **Lernen**, testers only (`TesterOnly`, `src/features/study/`, `components/study/`,
  API `/api/tester/study`, backend migration 041, Settings section `/settings#study` "Lernen"): subjects (Fächer), goals (exam /
  assignment / presentation / other with a due date) split into parts with estimated minutes, and a planner that puts
  study sessions as ordinary tasks (`tasks.goal_part_id`, `plan_pinned`) into the free gaps of the calendar within the user's
  study windows. A goal is "behind" when planned sessions were missed (home card with Ansehen / Später / So lassen,
  `/study?replan=1`; "Später" stores today's date in localStorage `studyLater` and hides the card until the date changes).
  Estimates: history, page ranges, optional AI ("Schätzen lassen" or the setting "automatisch"), defaults; the source shows under
  each estimate. **AI estimates go to Anthropic** (only part names, subject name, kind, days until due; consent = the tap / the
  switch; hidden without `ANTHROPIC_API_KEY`), so privacy § 5 names Anthropic (`PROCESSORS.aiProvider`). Push kind `study`
  (label "Lernen"/"Studying", `docs/notifications.md`).
- `/routines`, `/routines/:id/run` — **Routinen** (`components/routines/`, slice `routines` in
  `features/routines/routines.js`, API `/api/routines`): steps with minutes, weekdays + time (push at the time,
  and an in-app toast via `useRoutineReminders`), templates (texts `routineTpl_*`), guided run by the wall clock
  (localStorage `routineRun`), runs booked. Home's dashboard (`home/Today.jsx`, under the motivation strip):
  focus today vs. the daily goal (localStorage `focusGoal`), today's routines, up next, quick note (→ notebook).
  Texts of all of this in `i18n/focusTexts.js`. Menu and tab bar (5 tabs) have Fokusraum; shortcuts G F / G R.
- **Erinnerungen** — testers only, no tab of their own (`features/reminders/reminders.js`, slice `reminders`,
  `useReminders` in App; `components/reminders/`; texts `i18n/reminderTexts.js`; API `/api/tester/reminders`,
  migration 039): a text and a time, no task. Once (`at`) or on weekdays (`days` 1 = Monday + `atTime`), "Erledigt"
  ends a once one, "10 Min. später" snoozes (`snoozedUntil`). They live in Postfach → Erinnerungen (`ReminderList`
  above the tasks' reminders), the new-task form's kind switch has a third choice "Erinnerung" (QuickAdd swaps in
  `ReminderForm`, the typed text goes along; `showForms('reminder')` opens it so), the command bar "Neue Erinnerung".
  Times are worked out on the device (`occurrences`, `nextOccurrence`, `dueOccurrence`). The server pushes them
  (kind `plan`, `utils/focus.js` `pushReminders`) except to devices with `push_subscriptions.alarms`. While the web
  app is open a due one covers the page (`ReminderAlert`). **Android app**: rung natively like an alarm clock
  (`features/native/alarms.js` → plugin `QuideyAlarms` in quidey_android: `AlarmsPlugin`, `Alarms`
  (`setAlarmClock`, next 14 days, ≤ 100), `AlarmReceiver` (channel `alarm`, insistent alarm sound, full-screen
  intent, quiet after 5 min), `AlarmActivity` (native, over the lock screen), `BootReceiver`, `AlarmStore`); taps
  there are kept on the device until sent (`pendingActions` / `clearActions`), sign-out / account switch
  `cancelAlarms()`; `PUT /api/tester/reminders/device { endpoint, alarms }` tells the server this device rings
  them. Settings → App "Erinnerungen als Wecker" (testers, app only) shows the three permissions (exact alarms,
  full screen, notifications) with a way to Android's page.
- `/calendar` — month / week / agenda views, drag tasks between days, keyboard grid,
  `TaskEditor` (times, reminders, repeat weekly/monthly/yearly, notes, groups/labels, sharing).
  Several calendars: `?cal=session-<id>` shows a shared session's tasks, `?cal=family-<id>` a
  family's calendar; picker in the toolbar. `src/features/calendar/sources.js`
  (`useSharedCalendar`) loads them and routes add/move/edit/delete to their API; DayPanel gets
  `personal={false}` (no groups/reminders/sharing, "von X", delete only with `canRemove`).
- `/community` — **Sozial** (DE; EN "Social", formerly "Gemeinschaft"): everything with other people on one page
  (`components/community/Community.jsx`, paths in `src/features/community/paths.js`). Tabs with their
  own address: Feed (`/community`), Fortschritt (`/community/progress`, `Progress.jsx`),
  Sitzungen (`/community/sessions`, the old `/together` list),
  Freunde (`/community/friends`, the old Social, `?tab=add|requests`), Family (`/community/family`).
  `/together`, `/social`, `/family` redirect there; `/together/:id`, `/family/:id`,
  `/u/:username` stay. The menu entry counts session invites + friend requests + family invites and
  shows any of the `news` dots (`feed`, `together`, `social`). The Fortschritt tab holds
  `LevelCard` (level, tier, XP bar, growth line of the 8 tiers, next unlocks, how XP works, all
  unlocks) on the left and `Challenges` (today 3, this week 2) + `Ranking` (XP since Monday among
  friends who show their statistics) on the right (one column below 46rem); level-up and challenge
  toasts and the plant card lead there. Beside the other tabs (≥58rem, container query) a rail with
  `OnlineNow`, only while I have friends; on a phone only above the feed.
  - Feed (`Feed.jsx`, `FeedEntry.jsx`, slice `src/features/feed/feed.js`): entries of friends and me
    (`day` = the day's focus/tasks, updated as it grows; `challenge`, `level`, `streak`, `post` up to
    280 chars), grouped by day, cheering on (one per person, flame), mine can be removed. Live:
    `feed:changed` reloads it and sets `news.feed`, `feed:cheered` toasts.
  - Rail also has `OnlineNow` (friends online, write to them). Ranking rows show each friend's
    streak and online dot.
  - Streaks: `/api/progress` also returns `streakToday`, `bestStreak`, `recentDays` (7 × { day,
    active }), `todayFocusMin`, `streakMilestones`. `fetchProgress` toasts "Serie verlängert" /
    milestones (3, 7, 14, 30, … with confetti) when today makes it, and once a day from 18:00 a
    reminder while today is still open (`streakNudge` in localStorage).
  - Level plant (`components/progress/LevelPlant.jsx`): an SVG avatar that grows with level + XP
    share (seed in a pot → sprout → sapling → shrub → tree on an island → grove → forest → old
    tree with fireflies); parts keep keys and move via CSS transforms, so they grow in place.
    Large on `/profile` (`PlantCard`: "Wachstum ansehen" replay, slider through the levels), small
    in `ProfileCard`, `LevelCard` and Home's strip.
  - XP/levels/challenges (`src/features/progress/progress.js`, same rules as the api's
    `utils/progress.js`): 1 XP per focus minute (≤600/day), 5 per task (≤30/day), challenge XP.
    Level n→n+1 needs 150 + 75·(n−1) XP, top level 50 (`MAX_LEVEL`); the owner (`is_owner`) is always
    on it. Tiers seed … ancient. `useProgressWatcher` (App) re-checks after every saved session and
    ticked task; new challenges done / level ups toast (+ confetti by motion level).
  - Unlocks by level (`requiredLevel`, `UNLOCKS`): emojis (40, by 10s at 1/3/6/12), colours (4 more
    at 4), banners (stripes/grid 5, aurora/glow 8, rings 14, topo 18, sky 24), avatar frames (ring 10,
    double 16, dotted 22, orbit 30), titles (from 5), up to 3 pinned badges (18). Locked choices are
    shown dimmed with their level; a value already chosen stays allowed; unlocks never go away
    (`users.level` = highest reached). Profile also has `shareActivity` (automatic feed entries).
- `/family/:id` — **Quidey Family**, for everybody (was tester only until 2026-10-25); each family I am in has a direct link in the menu (under Gemeinschaft) and in the header's people panel (`TeamQuickPanel`):
  a fixed group of friends with a shared calendar (entries editable on the page via
  `TaskEditDialog handlers={…}` and in the calendar) and its own chat. Also: a board (`note`, any
  member), emoji + colour (owner, `FAMILY_EMOJIS`), a list (entries without a day), who takes
  care of an entry (`assignee_id`, "Nur meine" filter), members online and their week (focus,
  streak; only who shows statistics). Slice `family` in
  `src/features/family/family.js` (list + invites, `useFamilyList` in App), pages in
  `src/components/family/`. API under `/api/families` (behind `requirePro`) (backend migration 022).
  Entries can be **events** (`family_tasks.kind`, migration 040): they need a day, are done once over (family
  owner's time zone, `syncFamilyEvents`), have no tick ("Demnächst" has the kind switch, editor and family calendar
  `allowEvents`). Entries have **reminders** (`family_tasks.reminders`, only with a day; editor `remindsAll`, hint
  "Erinnert alle Mitglieder"): pushed (kind `plan`) to every joined member at the owner's times (`pushFamilyEntries`,
  `push_sent_for`). **"Aus meinen Aufgaben"** (`family/MoveMyTasks.jsx`, `movableTasks`, `moveToFamily`): one of my
  own open tasks / coming events moves in after a question (`POST …/tasks { taskId }`: details + reminders copied,
  my task deleted; repeating, shared or done ones refused: `TASK_REPEATS`, `TASK_SHARED`, `TASK_DONE`).
  `done_by` / `completed_at` of family and session tasks are booked for the statistics.
- **Boards: notes pinned in families and sessions** (`features/board/board.js`, `components/board/NoteBoard.jsx`; on
  the family page under the board text, on a session page as its own card): a member pins one of their own notes
  (`board_notes`, migration 037, max 30 per board); the others read it as it is now (edits show, the trash or deleting
  takes it off, notes of people no longer in it are hidden) and can't change it; the note's owner and the family's /
  session's owner take it off. Cards with a preview, the open note in a sheet (pictures loaded then), a picker of my
  notes. An ended session's board is read only. API `GET|POST /api/families/:id/board`, `GET|DELETE …/board/:pinId`,
  the same under `/api/shared-sessions/:id`, `GET /api/notebook/:id/boards`; live `board:changed { kind, id }`.
  Texts `noteBoard*` in focusTexts.js (plain `board*` keys belong to the departure board).
- `/stats` — **Statistiken** (formerly `/history`, which redirects): tabs Übersicht | Sitzungen |
  Erledigt (`?tab=`), period Woche/Monat/Jahr/Gesamt stepped back with arrows (`?range=&offset=`,
  `src/features/stats/period.js`). Overview from `GET /api/stats?from&to`: tiles, stacked columns
  focus + event time (`stats/TimeChart.jsx`, fixed validated pair blue/orange, table view), bars per
  event type and per group, "In Sitzungen & Familien" (`stats/TogetherStats.jsx`: team stopwatch time, per place
  done / events, from `together`), then the all-time `ProfileStats` ("Aktivität"). Sessions list in
  `stats/SessionList.jsx`, completed tasks in `CompletedTasks.jsx` (events left out; a second part from
  `together.done`). Session and family work counts in `tasksDone` and the events: tasks I ticked off
  (`done_by`) or that were given to me, events I added or was given (a session copy of my own task isn't counted twice).
- Repeats: `tasks.repeat_left` (how many more times, null = no end; "Endet: nie / nach N") and
  `tasks.repeat_skip` (coming days deleted on their own). Deleting a repeating task (or a coming
  repeat, which the calendar's day panel lists as a preview row) asks "only this / this and
  following / all" (`DeleteScopeDialog`, `askDeleteScope`, `deleteTaskAsking`;
  `DELETE /api/tasks/:id?scope=one|following|all&occurrence=YYYY-MM-DD`).
- Event types have `keywords`; an event whose name has a word starting with one gets the type by
  itself until one is picked by hand (`matchEventType` in `kinds.js`); a task whose name fits
  offers "als Event eintragen". New types get their name as first keyword.
- `/profile`, `/settings` — profile, password, "sign out everywhere", delete account; settings in
  areas (Darstellung | Planen | App, the area in the URL hash, `#event-types` opens Planen),
  each section a label column beside a panel; language,
  theme (dark/light/system; system when nothing is saved, also in `theme-init.js`; the app saves the
  choice on every start, so devices that had used it keep `dark`), colour palette (the ground: warm (default), graphite, nord, forest,
  plum, mono — `<html data-palette>`, values in `index.css`, swatches in `preferences.js`
  `PALETTES`), accent colour (green, ocean, violet, sunset (default), rose, gold — also recolours
  the favicon), motion level, home layout. "App": the tour and (where possible) installing.
  Password fields use `PasswordInput` (eye button to show/hide).
- Friends tab (`Social.jsx`) — friends and friend requests; names link to `/u/:username`, the Add
  tab can open a profile before sending a request.
- Profiles: `/profile` shows my profile card (banner, avatar, status, bio, study, interests),
  "Profil gestalten" (`components/profile/ProfileEditor.jsx`, live preview; the card's button goes to
  `#customize`, the editor's id, which opens it below the plant and scrolls there) and my numbers in short
  (the full statistics are on `/stats`).
  `/u/:username` (`UserProfile.jsx`) shows somebody else: non-friends only see display name and
  username (plus add / accept / withdraw), friends see the whole profile, mutual friends and the
  statistics unless `showStats` is off. Pieces in `src/components/profile/` (`ProfileCard`,
  `ProfileAvatar`, `ProfileStats` — tiles, 26-week heat map, last 14 days, weekdays, top groups,
  badges). Option lists in `src/features/profile/profileOptions.js` (same lists as the API),
  badges are derived from the numbers (`badges.js`, nothing stored).
- Sessions tab (`Together.jsx`), `/together/:id` — shared live study sessions: members, shared task list, a
  stopwatch counting for everyone, activity feed, session chat (realtime). Session tasks can carry
  the same details as own tasks — day, time, prio, duration, location, link, details, colour — all
  optional (only the name is required), edited by any member via `TaskEditDialog shared={…}`
  (`TaskEditor personal={false} allowEvents`). Session entries can be events
  (`shared_session_tasks.kind`): they need a day, are done once over (session owner's time zone,
  `syncSessionEvents`), have no tick, assignee or stopwatch and stay out of Home's list. Reminders, repeating, groups and sharing stay personal; adding
  an own task (or coming own event, `ShareMyTasks`) copies its details, later edits don't sync back (only `done` does).
- Sub-groups in sessions and families — **for everybody** (testers only until 2026-10-28): a session's or family's
  entries sorted into named groups (`shared_session_groups` / `family_groups`, entries'
  `group_id`, migration 030; max 20, name ≤ 40, unique per session/family; deleting one keeps its
  entries). `components/subgroups/SubGroupBar.jsx` ("Alle" + chips with open counts, "+", delete
  the shown one) above `SharedTaskList`, on the family page (filters calendar entries and list),
  and on Home under a session's group (the pick is `groupToDisplay.group.subGroupId`, so the
  new-task form files into it); the editor gets a "Untergruppe" select (`subGroups` on
  `TaskEditDialog shared/handlers`). Helpers in `features/tasks/subGroups.js`. API:
  `POST|DELETE /api/shared-sessions/:id/groups[/:groupId]`, same under `/api/families/:id/groups`
  (the old `/api/tester/...` addresses still answer testers); `group_id` on the entry POST/PATCH from
  any member, checked to belong to that session/family.
- `/inbox` — direct messages between friends + notifications/admin broadcasts (realtime).
  From 1100px the messages tab is split: conversations beside the open one (`?with=<userId>`).
- `/feedback` — feedback form (mailed to the owner). `POST /api/feedback` also takes category
  `rating` ({ liked, stars 1–5 when liked, message }) from the onboarding question.
- `/admin` — only for `isAdmin`: overview, beta requests (approve/decline), users (pro/admin
  toggles), broadcasts, tester feedback (`?tab=testers`, `tester/AdminTesterFeedback.jsx`:
  average, star spread, "favourite of N", comments per topic), admin action log.
- `/tester` — **Testbereich**, testers only (`TesterOnly` route guard; menu entry "Tester" beside
  Admin, also in the top tabs and the command bar). `components/tester/Tester.jsx`: the interface
  variants (preview, "Verwenden", stars 1–5 + comment each), "Dein Vergleich" (my variants by my
  stars) and the features in test (`TEST_FEATURES` in `src/features/tester/feedback.js`: add/remove
  an entry + texts `testerFeature_<id>` / `testerFeatureHint_<id>` in `i18n/testerTexts.js`, no
  server change). A star saves at once (same star again removes it), the comment with its button.
  API `GET /api/tester/feedback`, `PUT|DELETE /api/tester/feedback/:topic` (topics `ui:<variant>`,
  `feature:<id>`), admins `GET /api/admin/tester-feedback` (migration 027).
- Interface variants (testers only, `src/features/tester/variants.js`, `settings.uiVariant`,
  localStorage `uiVariant`; everybody else always gets `current`): `current` (today's look),
  `schulheft` (white squared paper that drifts at 12 % of the scroll as if far behind — a scroll-driven
  animation, standing still on "minimal" motion or without support —, ballpoint blue, red margin only on the task in focus, Lexend,
  tabs on top, week as a timetable), `lesesaal` (bottle green + brass lamp light on the focus card,
  Source Serif 4 / Source Sans 3, narrow icon rail, Home with the lamp-lit focus + `Seats` first:
  from 1100px beside the list, narrower one column),
  `uebersicht` (dense, M PLUS 1 at a 14px root, hairline modules under a red rule with their name
  in ink, compact sidebar + the command bar as a field in the header, Home as a grid mosaic),
  `tafel` (night-blue departure board, Barlow Semi Condensed, yellow only for now/changes, tabs on
  top, Home starts with `variants/DepartureBoard.jsx`). Each variant has a light and a dark rendition.
  How it works: `<html data-ui>` (set by `useApplyUiVariant` once the variant's stylesheet
  `src/ui-variants/<id>.css` has loaded — a lazy chunk, fonts self-hosted, latin subsets only);
  colours: each variant has its own ground and accent (`data-palette="own"` / `data-accent="own"`,
  the default); Settings → Farbpalette / Akzentfarbe show the variant's own first and any other
  palette or accent can be laid over it, remembered per variant (`settings.uiColors`, localStorage
  `uiColors`, `setUiColors`, `selectColorChoice` — "current" keeps `settings.palette/accent`). So
  each variant file has three layers: always (type, shapes, signature derived from `--primary`),
  `[data-palette="own"]` (ground) and `[data-accent="own"]` (accent). Every rule is under
  `:root[data-ui="<id>"]` and targets
  `data-part` hooks (`shell`, `header`, `menu`, `menu-item`, `topnav-tab`, `tabbar`, `home`,
  `home-title|week|momentum|columns|list|focus`, `week-day`, `task-row`, `task-check`, `focus`
  (+ `data-active`), `timer`, `board`, `seats`), active nav items carry `aria-current` or
  `data-active`. The navigation model per variant (`UI_VARIANTS[id].nav`: `sidebar | rail | top |
  command`, `useNavModel()`, `useMenuDocked()`) is generic: `AppShell.module.css` (`data-nav` on the
  shell sets `--sidebar-w`, and for `top` a taller `--header-h`), `Menu.module.css` (`.undocked`
  drawer on wide screens, `.rail`), `Header` (`TopNav` row, command field). Surface brief:
  `.impeccable/surfaces/src-app-jsx.md`.
- `/arcade` — **Arcade**, for everybody signed in, also before beta access (the beta screen's waiting room; in the
  app: menu after Statistiken, command bar). `components/arcade/` (`ArcadePage`, `Reflex`, `Pattern`,
  Arcade.module.css), `features/arcade/arcade.js`, texts `i18n/arcadeTexts.js`. Games: `reflex` (a light on a 4 × 4
  field, endless: 5 % quicker every 8 hits, a light gone out untouched or a dark tile ends it, quick hits double), `pattern` (four coloured pads with `playPad` tones from sound.js,
  the pattern grows each round; score = rounds) and the three quiz games of `components/fun/` (score = streak, per difficulty; they
  report it through `onScore`). Mode per run, remembered in localStorage `arcadeMode`: `ranked` (personal best +
  leaderboard, display and user name public to everybody signed in) or `casual` (default: only my personal best).
  Leaderboard per game and difficulty beside the game (top 25 + my place), "Mich aus allen Ranglisten nehmen". API
  (behind authenticateToken, not requirePro): `GET /api/arcade/me`, `POST /api/arcade/scores { game, level, score,
  ranked }` (rate limited, scores checked against each game's max; client scores, so for fun only),
  `GET /api/arcade/leaderboard?game=&level=`, `DELETE /api/arcade/ranked`. Table `arcade_scores` (migration 038).
- `/fun` — the old hidden playground, gone: redirects to `/arcade`. Its quiz games (`components/fun/`
  WordGuess, Scramble, Sequence, Stats; `features/fun/`) live on in the Arcade; the daily line in the
  header (`DailyTicker.jsx`, today's fact / quote / slogan behind a bulb) links to `/arcade`.
- Task sharing: send a task to a friend (`task_shares`), accepted shares appear in their list.
- Task colours: `tasks.color` (8 names, `src/features/tasks/taskColors.js`); rows and chips set
  `data-task-color`, the tones live in `index.css` as `--task-color` per theme. An event without
  its own colour takes its type's.
- Tasks vs. events (`tasks.kind`, `src/features/tasks/kinds.js`): a task is ticked off by hand, an
  event needs a day and is done once it's over — the server ticks it off (every minute, on
  `GET /api/tasks`, on save; repeating ones get their next one), `useEventEnds` reloads the list
  when one ends. `duration_minutes` = a task's planned time (shown against focus time,
  `plannedTime.js`) or an event's length; both set on wheels (`task/DurationWheel.jsx`). An event also
  has an end field beside its start (TaskEditor, TaskForm): start + length = end, setting the end
  changes the length (`features/tasks/eventTimes.js`, an end at/before the start is the next day). Events
  have a type from my own list (`event_types`, `state.task.eventTypes`, managed in Settings →
  Event-Typen, `EventTypeSettings.jsx`; picker `task/KindFields.jsx`). Home's list holds tasks
  only; today's events sit above it (`task/TodayEvents.jsx`). Events can't be focused or overdue; shared
  into a session they stay events there. The week strip has no calendar card (menu and tab bar lead there; the title row's overdue
  count links to the agenda).

PWA: installable app. `public/manifest.webmanifest` + icons in `public/icons/` (logo on the dark
background, incl. a maskable one and the apple-touch-icon). `pwa.js` is a Vite plugin that writes
`dist/sw.js` at build time: it precaches every built file plus `PUBLIC_FILES`, one cache per build
(`quidey-<hash>`), navigations network-first with the cached index.html as offline fallback,
`/assets/*` cache-first, never `/api`, `/socket.io` or other origins (no personal data in the
cache). No `skipWaiting` — an update must not reload a running timer. Registered only in the
production build (`src/features/pwa/registerServiceWorker.js`); `_headers` sends `/sw.js` with
`no-cache`. Settings → "Als App": `src/features/pwa/install.js` catches `beforeinstallprompt` at
startup and offers it as a button (Chrome/Edge/Android), explains the share menu on iOS Safari,
says "installed" when running standalone, and hides the row everywhere else. On Android phones in
the browser the section "Android-App" above it offers the APK (`features/native/androidApk.js`,
`/download/quidey.apk`, version + size): the Android repo's `npm run apk:web` builds the signed
release APK and writes it with `quidey-android.json` into `public/download/` (git-ignored, so it
goes out with the next deploy but never into git); `vite.config.js` hands the details over as
`VITE_ANDROID_APK` (web build only), no APK → no row. The service worker leaves `/download/`
alone; `_headers` sends it `no-cache` + as attachment. Cloudflare's limit is 25 MiB per file.

Push notifications (Web Push, VAPID): Settings → App → "Benachrichtigungen" per device (on/off,
then six kinds `plan` (tasks/events at each of their reminders, also my families' entries), `digest`
(morning overview 07:30–11:00 local), `messages`, `social` (friend requests, session/family
invites, shared/assigned tasks incl. family entries given to me, broadcasts; admins also new beta requests), `groups`
(somebody else added entries to my family / session: inbox notice `entries_added`, bundled per person and place for
30 min while unread, backend `utils/groupNotices.js`; family / session chat messages), `study` (testers: a study goal is behind its plan, at most once a day, 08:00–19:00 local, kept 3 h; label "Lernen"), and "Test senden"). The whole
list of when anybody is notified: **`docs/notifications.md`** (keep it up to date). `src/features/pwa/push.js`
(external store, `usePushState`; `refreshPush` on every start via `usePushSync` in App re-PUTs the
subscription, so a renewed address or another account is picked up and a revoked permission turns
it off; `enablePush` asks for the permission first, from the click). After creating a task
(`addTask` → `offerPushAfterTask`) `PushOffer.jsx` asks once per device while it's off.
localStorage `push` ('on'|'off'), `pushEndpoint`, `pushAsked`. Sign-out DELETEs the device with
the old token (keepalive); another remembered account taking over keeps it on. The service
worker (`pwa.js`, `PUSH_HANDLERS`) shows a push unless the app is focused (the test and Safari
always show: Safari revokes silent pushes); a click focuses the app and posts `quidey:open`, the app
navigates (no reload). In dev Vite serves a push-only `/sw.js` (no caching), registered in dev too.
With push on, the in-app reminders (`reminders.js`) only toast. iPhone/iPad: only as installed app.
Turning on runs strictly after any running check (`inTurn` queue in push.js: a startup check used
to undo a fresh sign-up), asks the permission first, from the click; a failure keeps the step's
text (`pushErrorNoAnswer` — the question was closed or only shown as Chrome's bell,
`pushErrorService` — the browser's push service refused, e.g. Brave or no Google services,
`pushErrorServer`) plus the browser's own error as `detail`, shown under it in Settings.

Reminders: a task has a list `tasks.reminders` (minutes before the start, 0 = at the start, up to
5, migration 029; the API still reads/answers a single `reminder_minutes` for older apps). A task
without a time of day "starts" at the account's all-day time (`users.allday_reminder_time`,
default 12:00, Settings → App, `PUT /api/users/reminder-time`, `/api/me` → `allDayReminderTime`,
`state.auth.access.allDayReminderTime`): "Am Tag" is that time on its day, "1 Tag vorher" the day
before. The editor (`TaskOptionsFields`) offers toggles (timed: start … 1 day before; all-day: on
the day, 1/2 days, 1 week before) and needs a day; picking a time before a day takes today.
New tasks start with `[0]` while push is on for this device (`defaultReminders()` /
`pushRemindsByDefault()`; TaskForm and the calendar's quick add). Pushes, mails, in-app toasts,
the inbox's reminder tab and the .ics export all use the same rule; of several due at once only
the latest goes out (`push_sent_for` / `reminder_mailed_at` = the reminder time sent for; a later
one follows, a task moved before that time reminds again).

Client-side storage: only `localStorage` (no cookies), plus the service worker's Cache Storage
for the app's own files: `token` (JWT), `accounts` (several accounts on one device:
`[{ username, displayName, token }]`, max 5, `src/features/auth/accounts.js`; switching reloads
the app as the other one, signing out takes over the next remembered account), `language`, `accent`,
`theme`, `palette`, `motion`, `sound`, `analytics` (Android app: the answer to the usage data question), `homeLayout`, `showSharedTasks`, `calendarView`, `timerMode`,
`teamSessionId`, `arcadeMode` (ranked | casual), `reminderSeen` (testers' reminders already shown in the page), `notesSort` / `notesLayout` (testers' notes area), `streakNudge` (day of the last streak reminder), `studyLater` (testers: the day the "plan is behind" card on Home was put off), `uiVariant` and `uiColors`
(testers' interface variant and the colours picked per variant), `push`, `pushEndpoint`,
`pushAsked` (push notifications on this device), `onboarding:<username>` (a new account's action
count, whether install / rating were asked). `public/theme-init.js` applies
the theme before React loads.

## Quidey Pro, access, sign in with Google, Android app

- **Access** (backend `utils/access.js`): `ACCESS_MODE=beta` (default): testers (beta access given
  by an admin: approving a request / `npm run pro -- grant` sets `is_tester`), Pro and admins get
  in; taking tester away takes the access away. `ACCESS_MODE=open` (after the beta): everybody,
  with the free plan's limits unless Pro / tester / admin (`utils/limits.js`: 10 open tasks,
  5 events ahead, 3 groups, 1 shared session, 3 friends incl. own open requests, statistics of the
  last 7 days; new ones get 403 `LIMIT_REACHED { limit, max }`, what exists stays). Pro =
  `users.is_pro` (a gift: admin "Pro (Geschenk)", CLI `gift|ungift`) or a running subscription
  (`users.pro_until`). Pro never sees test features. Migration 035 turned every old `is_pro`
  (= beta access back then) into a tester. `/api/me`: `isPro` still means "may use the app" (old
  app versions read it), plus `pro { active, gift, until }`, `accessMode`, `limits`/`usage`
  (null without limits), `hasPassword`, `googleLinked` (→ `state.auth.access`).
- **Quidey Pro is switched off** (built and tested, not shown; planned for after the beta). Two
  switches, turned on together by hand: `VITE_PRO=on` at build time (`features/pro/flag.js`:
  `proBuilt()` for the legal texts, `useProOn()` = built and `/api/me` `proSales`) and
  `PRO_BILLING=on` on the server (`utils/access.js`: else the selling routes `GET /api/billing`,
  `/checkout`, `/portal`, `/play` answer 404 `BILLING_OFF`, and the free plan has no limits even
  with `ACCESS_MODE=open`; webhooks and `/api/billing/cancel` stay on). Off: no `/pro` (redirects
  to `/`), no menu entry, no profile / beta screen card, no `LimitDialog`, no Play restore, no
  `/kuendigen` and no cancel link, terms without § 8–9 and privacy without § 7 (the later sections
  move up: `privacyNo` / `termsNo` in LegalPage.jsx). Gifted Pro (`is_pro`) still lets people in.
  The landing page shows the free plan and the planned prices as "Geplant für nach der Beta",
  without a way to buy. Turning on: both switches, a new `LEGAL_VERSION_DATE`, the cancel link on
  the landing page (`copy.js` `legal()`), and tell users about the new terms.
- **Quidey Pro** (supporting the development: 2,99 €/month, 25 €/year = "Spare 30 %", 10,88 €;
  Kleinunternehmer § 19 UStG, no VAT): `/pro` (`components/pro/ProPage.jsx`, reachable from the
  beta page too, menu "Quidey unterstützen" with the `heart` icon, profile card `#pro`). Texts in
  `i18n/proTexts.js` (kind: why it exists first, the free Quidey stays welcome). Web: Stripe
  (`POST /api/billing/checkout` → Checkout, `/api/billing/portal`, webhook
  `/api/billing/stripe-webhook` with the raw body); Android app: Google Play Billing through the
  app's plugin `QuideyBilling` (`features/pro/pro.js`: `playPlans`, `buyInPlay`,
  `restorePlayPurchases` on every start, `managePlaySubscription`), the server checks tokens
  (`POST /api/billing/play`, Play Developer API) and gets real-time notifications
  (`/api/billing/play-notifications?token=`). In the app never a word of Stripe or web prices
  (Play policy). `GET /api/billing` → status + `playAccountId` (HMAC of the user id, handed to Play
  as obfuscatedAccountId). Backend `utils/billing.js`, table `subscriptions`, `refreshProUntil`;
  deleting an account cancels its subscriptions. `pro:changed` (socket) → App re-reads access.
  Free plan full → `apiFetch` fires `LIMIT_EVENT` → `components/pro/LimitDialog.jsx`; Stats shows
  only this week then (`usePlan().limited`).
- **Cancel button** (§ 312k BGB): `/kuendigen` (`CANCEL_PATH`, a public legal page,
  `legal/CancelForm.jsx`, "Jetzt kündigen" → `POST /api/billing/cancel`, no sign-in; Stripe
  subscriptions of the matching account end at period end, a confirmation mail with the time goes
  out at once, a copy to `CONTACT_TO`); linked in `LegalFooter` on every screen, on the landing page
  and on `/pro`. Terms § 8 Quidey Pro, § 9 Widerrufsbelehrung (`#pro`, `#widerruf`); privacy § 7.
- **Sign in with Google** (`features/auth/google.js`, `components/auth/GoogleSignIn.jsx`): the
  server hands out a single-use nonce (`GET /api/auth/google/nonce`), the token must carry it.
  Web: redirect to Google (`response_type=id_token`, `state` in sessionStorage) and back to
  `/auth/google` (SignIn → Profile `googleReturn`), no Google script, CSP unchanged. App: native
  account picker (plugin `QuideyGoogle`, Credential Manager). `POST /api/auth/google` signs in
  (found by `users.google_sub`, else by email: linked; an unconfirmed account found by email loses
  its password and logins) or answers `{ signup }` → `GoogleSignupForm` (display name, username,
  birth date, consents) → `POST /api/auth/google/register` (no password: `has_password=false`;
  setting the first password needs no current one, deleting confirms with the username).
  `VITE_GOOGLE_CLIENT_ID` (frontend) = `GOOGLE_CLIENT_IDS` (backend), the "Web application" client.
- **Android app** (Capacitor 8, repo `quidey_android`): the same build in a WebView served as
  `https://app.quidey.com` (server.hostname: CORS and autofill as on the web). Native-only code:
  `features/native/native.js` (`isNativeApp()`, back button, system bars, resume) and
  `features/native/nativePush.js` (FCM: the token goes to the server as endpoint `fcm:<token>`,
  one notification channel per kind, built only with `VITE_NATIVE_PUSH=on`, i.e. when
  `android/app/google-services.json` exists; a push that comes while the app is open is not shown by
  Android, like the web hides them in a focused tab, except the test: `onNativePushInApp` shows it
  through the app's plugin `QuideyNotice`, `NoticePlugin.java` in quidey_android). Shared files only branch on `isNativeApp()`: no
  service worker, install row "installed", push via FCM (`push.js` "app" branches), Pro via Play.
  Backend `utils/fcm.js` (FCM HTTP v1, `FIREBASE_SERVICE_ACCOUNT_FILE`); `push_subscriptions` rows
  with `fcm:` endpoints have no keys (migration 034). Besides Google Play, the APK can be downloaded
  in Settings → App on Android phones (see PWA above).
- **Google Analytics for Firebase** (Android app only, only with consent; privacy § 3):
  `features/native/analytics.js` + the app's plugin `QuideyAnalytics` (`AnalyticsPlugin.java`,
  `firebase-analytics` 23.2.0). The manifest keeps collection off by default (no advertising id,
  no Android id, no ad signals, no automatic screens, `AD_ID` permission removed). Asked once per
  device (`OnboardingPrompts` → `AnalyticsQuestion`, both answers styled the same, closing = ask
  again next start, never while another question / the tour is open), changed in Settings → App →
  "Nutzungsdaten"; localStorage `analytics` = 'granted' | 'denied'. `setupAnalytics()` (from
  `setupNativeApp`) hands the answer to Android on every start; no = collection off +
  `resetAnalyticsData`. Counted: pages as names without ids (`screenName`, App), the onboarding
  actions as events (`noteAction` → `task_created`, `task_done`, …) and `focus_start` /
  `focus_end`. Never content, names or the account (no user id). Built only with the Firebase
  config (`VITE_NATIVE_ANALYTICS=on`, Android build script). Adding an event: plain names and
  params only, and list it in privacy § 3.

## API access

`src/features/helperFunction.js`: `apiUrl(path)` prefixes `VITE_API_URL` (empty in dev);
`apiFetch` adds `Authorization: Bearer <token>` and turns error JSON `{error, code}` into an
`Error` with `status`/`code`. In dev, Vite (port 5173, `strictPort`) proxies `/api` and
`/socket.io` to `http://localhost:3000`.

## Backend (`../quidey_react-backend`)

- Node + Express 5, CommonJS, one big `index.js` (~3100 lines, all `/api/...` routes),
  `realtime.js` (Socket.IO server), `db.js` (pg pool), `utils/mailer.js` (nodemailer),
  `utils/verificationToken.js`.
- PostgreSQL 18 locally (`quidey_db`). Schema in `schema.sql` (regenerated from pg_dump, see
  memory), incremental `migrations/001…019` (015: performance indexes, 017: task colour +
  reminder mails, 018: group colour, 019: testers + broadcast audience, 020: optional task fields on shared session tasks, 021: profile fields, 022: families — families, family_members, family_tasks, family_messages, 023: events — tasks.kind / event_type_id, event_types, 024: tasks.repeat_left / repeat_skip, event_types.keywords, shared_session_tasks.kind, 025: users.level / avatar_frame / profile_title / showcase_badges / share_activity, shared_time_days, challenge_completions, feed_events, feed_cheers, 026: users.show_online, families.note / note_updated_at / note_updated_by / emoji / color, family_tasks.assignee_id, 027: tester_feedback — per tester and topic rating 1–5 / comment, 028: push_subscriptions, tasks.push_sent_for, users.push_digest_on, 029: tasks.reminders (replaces reminder_minutes), 030: sub-groups — shared_session_groups, family_groups, shared_session_tasks.group_id, family_tasks.group_id, 031: users.tour_seen_at, users.allday_reminder_time, …, 036: note_folders, notebook_notes.folder_id / tags / color / archived / trashed_at, collections, collection_items, users.groups_imported_at, 037: board_notes, 038: arcade_scores, 039: reminders + push_subscriptions.alarms, 040: family_tasks.kind / reminders / push_sent_for / done_by / completed_at, shared_session_tasks.done_by / completed_at, push_subscriptions.groups, notification kind entries_added, 041: study goals — subjects, goals, goal_parts, study_windows, tasks.goal_part_id / plan_pinned, users.study_*, push_subscriptions.study). Tables: users, tasks, groups, task_groups, notes,
  sessions, session_tasks, session_shared_tasks, friendships, task_shares, shared_sessions,
  shared_session_members / _tasks / _events / _time, messages, notifications, broadcasts,
  beta_access_requests, admin_actions, email_verification_tokens.
- Auth: bcrypt passwords, JWT with `token_version` (revocable: password change / sign out
  everywhere bumps it), email verification required, terms acceptance stored,
  express-rate-limit on auth routes. `is_pro` OR `is_tester` gates all app routes (`requirePro`,
  helpers in `utils/access.js`, also used by the socket and reminder mails); `is_admin` the admin routes;
  `is_owner` (migration 014) can only be set by a DB superuser and forces admin on.
  `is_tester` (migration 019, set in the admin panel): gets into the app and sees unreleased
  features; admins always count as testers (`/api/me` → `isTester`). Tester-only API routes go
  under `/api/tester/...` (closed by `requireTester`, 403 `TESTER_REQUIRED`). Frontend:
  `<TesterOnly fallback?>` / `useIsTester()` (`src/features/auth/tester.js`), also as a route guard.
  Broadcasts take `audience: 'all' | 'testers'` (testers = `is_tester OR is_admin`).
  The account row behind each request is cached for 15 s (`loadAccount`); every in-app change
  of token version / pro / admin / account calls `forgetAccount`, so only CLI/psql changes wait.
- Socket.IO: authenticates with the same JWT; rooms `user:<id>` and `session:<id>`; events
  `message:new`, `inbox:read`, `notification:new`, `session:event` (chat, with data) and the
  data-less "load again" signals `session:changed`, `invites:changed`, `friends:changed`,
  `tasks:changed`, plus for families `family:changed` { familyId } and `family:message`
  { familyId, message } (to the members' user rooms), for the feed `feed:changed` (author and
  friends) and `feed:cheered` { user, entryId }. Plain time reports (`/activity` every 30 s, online window 75 s) send nothing unless what the
  others see changed (started / stopped / switched task).
- Push (`utils/push.js`, `web-push`): `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
  (`npx web-push generate-vapid-keys`; without keys pushes are only logged `[DEV] Push to user …`).
  Table `push_subscriptions` (one row per endpoint, owned by the account that signed it up last,
  booleans `plan`/`digest`/`messages`/`social`, max 10 per account), `tasks.push_sent_for`,
  `users.push_digest_on` (migration 028). Routes behind `requirePro`: `GET /api/push/key`,
  `PUT|DELETE /api/push/subscription`, `POST /api/push/test`. `startPushSchedule` (every
  `REMINDER_CHECK_MS`) pushes due entries (SKIP LOCKED, once per time; events also when already
  ticked off) and the digest; routes call `pushLater`/`pushInvite` (messages, friend requests,
  session/family invites, task shares, assignments, broadcasts; `pushBetaRequest`: a new beta request to every admin). 404/410 from the push service
  deletes the row; password change / logout-all delete all of the account's rows.
- Mail via SMTP (Resend, `smtp.resend.com`): verification links, task reminders, contact form and
  feedback to `CONTACT_TO`. Without `SMTP_HOST` mails are only logged. All mails share one HTML
  layout (`utils/mailTemplate.js`: tables + inline styles; user text always through `escapeHtml`).
- Reminder mails: `utils/reminderMails.js` checks every minute (`REMINDER_CHECK_MS`) for open tasks
  with `reminder_email`, computes the start in `users.timezone` (sent by the app via
  `PUT /api/users/locale`, default Europe/Berlin; without a time of day at
  `users.allday_reminder_time`) and mails the owner once per reminder time
  (`reminder_mailed_at`). Only the owner can switch it on.
- Profiles: `GET /api/profile` (mine), `PUT /api/profile` (only the fields sent: bio, status,
  study, interests, color, banner, emoji, frame, title, showcase, showStats, shareActivity; choices
  above my level → 403 `LEVEL_LOCKED`), `GET /api/profiles/:username` (rate limited
  per account; `relation` self/friend/incoming/outgoing/none decides what is in it). Statistics
  are computed per request (`loadStats`/`summarizeStats`, days in `users.timezone`), never stored.
  `/api/friends` also returns each friend's emoji, colour, status and level.
- Progress & feed (`utils/progress.js`): `GET /api/progress` (works out XP, completes challenges,
  raises `users.level`, keeps today's feed entry, posts milestones; also run after `POST
  /api/sessions`), `GET /api/progress/friends` (week ranking), `GET /api/feed?before=`, `POST
  /api/feed/posts`, `DELETE /api/feed/:id` (a `day` entry is hidden, not deleted), `PUT|DELETE
  /api/feed/:id/cheer`. Challenges are dealt per day/week by a hash of the date (the same for
  everybody; none that needs friends without any). Team stopwatch time is also booked per day in
  `shared_time_days`.
- Study goals (testers, `/api/tester/study`, router `study.js`, migration `041_study_goals.sql`): pure modules in `utils/` — `studyPlanner.js` (places sessions in free gaps), `studyStatus.js` (on track / behind), `studyEstimate.js` (history, pages, AI via the Claude API, defaults), `studyLoad.js`. Env: `ANTHROPIC_API_KEY` (without it no AI), `STUDY_AI_MODEL` (default `claude-haiku-5-5`). AI estimates: 20 requests per user per day (express-rate-limit, in memory), 8 s timeout, falls back to non-AI estimates; only part names, subject name, kind and days until due are sent.
- CLI: `npm run pro -- list|requests|grant|revoke|decline|admin|unadmin|tester|untester <username>`.
- Tests: `npm test` (`scripts/test/*.test.mjs`, node:test; api.test.mjs creates/drops its own DB). Extend for every new route.
- Config via `.env` (see `.env.example`): `NODE_ENV`, `DB_*`, `JWT_SECRET` (≥32 chars), `PORT`,
  `CORS_ORIGINS`, `TRUST_PROXY`, `SMTP_*`, `MAIL_FROM`, `CONTACT_TO`, `FRONTEND_URL`, `VAPID_*`, `ANTHROPIC_API_KEY`, `STUDY_AI_MODEL`.

## Deployment

**Frontend → Cloudflare Workers (static assets)**, configured in `wrangler.jsonc`: worker
`quideyreactmain`, serves `./dist`, SPA fallback (`not_found_handling: single-page-application`),
custom domain `app.quidey.com`. The app stays out of search results: `index.html` has
`robots: noindex`, `dist/_headers` sends `X-Robots-Tag: noindex` on every path, and
`public/robots.txt` allows crawling on purpose (a blocked crawler never sees the noindex). Search
engines get the landing page, which owns `robots.txt` + `sitemap.xml` on quidey.com. The landing page (`quidey_landing`) is its own worker `quidey-landing` on `quidey.com`; it
forwards the old app URLs that used to live there. There is no deploy script in package.json; deploy is
`npm run build` then wrangler (`npx wrangler deploy`). For the Android download, run `npm run apk:web`
in `quidey_android` before the build (only when the app changed: the file stays in `public/download/`).
- The production API address comes from `.env.production.local` (`VITE_API_URL=https://…`,
  git-ignored, ends up public in the bundle — never a secret).
- `security-headers.js` is a Vite plugin that writes `dist/_headers` at build time: strict CSP
  (`script/style/font-src 'self'`, `connect-src` = self + the API origin + its `wss:`), HSTS,
  X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy, COOP, and a one-year immutable
  `Cache-Control` for the hashed files under `/assets/*`. Hence: no inline scripts or
  styles from external hosts, no CDN fonts; the build must use the real API URL or calls get blocked.

**Backend → STRATO server** (named as backend host in the privacy policy), planned setup per
`../quidey_react-backend/DEPLOYMENT-SECURITY.md`: Node as a non-root user under systemd/pm2,
listening on localhost behind Caddy/nginx with HTTPS (e.g. `api.quidey.com`), `TRUST_PROXY`
matching the proxy count (1, or 2 with Cloudflare in front), Postgres only on localhost with the
limited role `quidey_app` (`scripts/db-app-role.sql`), migrations run as `postgres`, regular
`pg_dump` backups, `CORS_ORIGINS=https://app.quidey.com`, `FRONTEND_URL=https://app.quidey.com`.

## Legal / GDPR

German law applies: Impressum (§ 5 DDG), Datenschutzerklärung (DSGVO), Nutzungsbedingungen,
contact form — all in `src/legal/LegalPage.jsx`, owner details and processors (Cloudflare,
STRATO, Resend, Anthropic for the optional AI estimates) in `src/legal/owner.js`. Any feature touching personal data must update these
texts in the same change.

## Repo extras

`.claude/skills/`, `.agents/skills/`, `.taste-skill/` (design-review reports), `direction/`
(dark-theme design direction screens) are design tooling, not app code.
