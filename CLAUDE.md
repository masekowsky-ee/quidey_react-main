# Quidey — project overview

Quidey is a planner for learning and studying ("Planer für Lernen und Studium"): tasks, a focus timer, a calendar, and friends you study
with live. German-first (de default, en available), currently a **closed beta** — only users
with `is_pro` or `is_tester` (admins always) get into the app. The app runs on **app.quidey.com**;
the public landing page on **quidey.com** is a separate static site (repo `quidey_landing`).

Three repositories, side by side on this machine:

| Repo | Path | GitHub |
|---|---|---|
| Frontend (this one) | `C:\Users\eesge\quidey_react-main` | masekowsky-ee/quidey_react-main |
| Backend | `C:\Users\eesge\quidey_react-backend` | masekowsky-ee/quidey_react-backend |
| Landing page (Astro, static) | `C:\Users\eesge\quidey_landing` | not on GitHub yet |

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
- Realtime: `socket.io-client` (`src/features/realtime/socket.js`, `useRealtime(event, handler)`),
  loaded with a dynamic import only once signed in.
- Icons: one outline set, `src/components/icons.jsx` (`<Icon name size? />`, 24px grid, 1.7
  stroke); the calendar keeps its own `calendar/icons.jsx`. No icon files in `src/assets/`.
- Code splitting: every page except Home is `lazy()` in `App.jsx` (`PAGES`), preloaded when the
  app is idle (`preloadPages`); `LegalFooter` lives in its own file so the legal texts stay
  lazy. `vite.config.js` puts react / router / state / motion in their own long-cached chunks.
- i18n: `src/i18n/translations.js` (de/en dictionaries) + `useTranslation()` → `t(key)`.
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
4. Signed in, access not checked yet → `AppSkeleton` (the app's frame in grey, after 5 s
   "Verbindung…" + retry / sign out); not pro → `/beta` (`BetaGate`, user can
   request beta access).
5. Pro → full app in the frame `AppShell.module.css`: `Header`, `Menu`, `TabBar`, `Toaster`,
   `Tutorial`, animated page routes in `<main>`. Widths (`src/features/layout/breakpoints.js`,
   `useMediaQuery`): ≥1100px the `Menu` is a fixed sidebar and the header starts beside it;
   721–1099px the menu is a drawer behind the header's button; ≤720px a bottom `TabBar` (Start,
   Kalender, Gemeinschaft, Postfach, Mehr → drawer) replaces the header's button. The shell sets
   `--sidebar-w`, `--tabbar-h` and `--page-gutter`; fixed parts (toasts, timer button) and every
   page container use them. The closed drawer is `inert`; `setShowMenu(true|false)` (no argument
   toggles). Menu (Hick's law: few choices at once): Start, Kalender, Gemeinschaft, Postfach, then
   "Mehr" (Statistiken), at the bottom Admin/Einstellungen/Feedback and the
   `AccountSwitcher` (profile, switch account, add account, sign out). Under Gemeinschaft a row of
   the friends online right now (faces + "N Freunde online", `useOnlineFriends`); the tab bar puts
   a green dot on Gemeinschaft while any friend is online. The tour ("Einführung") lives in
   Settings → App. The header has a streak pill (flame + days, filled once today counts). The active entry is
   brighter ink, no fill; count badges are neutral (the accent stays on data, never on nav,
   tabs or buttons; one filled inverted primary per screen). The header's "Neu" opens the
   new-task form over any page (`QuickAdd`, `settings.showForms` via `showForms(true|false)`).
   Row actions in lists appear on hover/focus with a mouse (always on touch).

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
  first and the timer is the corner button. Colour, groups, description and priority are set in
  the editor (`TaskEditDialog`); a shown group's colour and deletion sit in the list's title row.
  Tasks of shared sessions can be taken out of "Alle" (`settings.showSharedTasks`, eye button in
  the list's title row and in Settings); a session's own group always shows them.
- `/calendar` — month / week / agenda views, drag tasks between days, keyboard grid,
  `TaskEditor` (times, reminders, repeat weekly/monthly/yearly, notes, groups/labels, sharing).
  Several calendars: `?cal=session-<id>` shows a shared session's tasks, `?cal=family-<id>` a
  family's calendar; picker in the toolbar. `src/features/calendar/sources.js`
  (`useSharedCalendar`) loads them and routes add/move/edit/delete to their API; DayPanel gets
  `personal={false}` (no groups/reminders/sharing, "von X", delete only with `canRemove`).
- `/community` — **Gemeinschaft**: everything with other people on one page
  (`components/community/Community.jsx`, paths in `src/features/community/paths.js`). Tabs with their
  own address: Feed (`/community`), Sitzungen (`/community/sessions`, the old `/together` list),
  Freunde (`/community/friends`, the old Social, `?tab=add|requests`), Family (`/community/family`).
  `/together`, `/social`, `/family` redirect there; `/together/:id`, `/family/:id`,
  `/u/:username` stay. The menu entry counts session invites + friend requests + family invites and
  shows any of the `news` dots (`feed`, `together`, `social`). Beside every tab (≥58rem, container
  query) a rail: `LevelCard` (level, tier, XP bar, growth line of the 8 tiers, next unlocks, how XP
  works, all unlocks), `Challenges` (today 3, this week 2) and `Ranking` (XP since Monday among
  friends who show their statistics); on a phone only with the feed (level + today above, week +
  ranking below).
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
- `/stats` — **Statistiken** (formerly `/history`, which redirects): tabs Übersicht | Sitzungen |
  Erledigt (`?tab=`), period Woche/Monat/Jahr/Gesamt stepped back with arrows (`?range=&offset=`,
  `src/features/stats/period.js`). Overview from `GET /api/stats?from&to`: tiles, stacked columns
  focus + event time (`stats/TimeChart.jsx`, fixed validated pair blue/orange, table view), bars per
  event type and per group, then the all-time `ProfileStats` ("Aktivität"). Sessions list in
  `stats/SessionList.jsx`, completed tasks in `CompletedTasks.jsx` (events left out).
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
  theme (dark/light/system), colour palette (the ground: warm (default), graphite, nord, forest,
  plum, mono — `<html data-palette>`, values in `index.css`, swatches in `preferences.js`
  `PALETTES`), accent colour (green, ocean, violet, sunset (default), rose, gold — also recolours
  the favicon), motion level, home layout. "App": the tour and (where possible) installing.
  Password fields use `PasswordInput` (eye button to show/hide).
- Friends tab (`Social.jsx`) — friends and friend requests; names link to `/u/:username`, the Add
  tab can open a profile before sending a request.
- Profiles: `/profile` shows my profile card (banner, avatar, status, bio, study, interests),
  "Profil gestalten" (`components/profile/ProfileEditor.jsx`, live preview) and my numbers in short
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
  an own task copies its details, later edits don't sync back (only `done` does).
- `/inbox` — direct messages between friends + notifications/admin broadcasts (realtime).
  From 1100px the messages tab is split: conversations beside the open one (`?with=<userId>`).
- `/feedback` — feedback form (mailed to the owner).
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
  `schulheft` (white squared paper, ballpoint blue, red margin only on the task in focus, Lexend,
  tabs on top, week as a timetable), `lesesaal` (bottle green + brass lamp light on the focus card,
  Source Serif 4 / Source Sans 3, narrow icon rail, Home one column with focus first + `Seats`),
  `uebersicht` (dense, M PLUS 1 at a 14px root, hairline modules with red tabs, compact sidebar +
  command bar Ctrl/⌘ K `variants/CommandPalette.jsx`, Home as a grid mosaic), `tafel` (night-blue
  departure board, Barlow Semi Condensed, yellow only for now/changes, tabs on top, Home starts
  with `variants/DepartureBoard.jsx`). Each variant has a light and a dark rendition.
  How it works: `<html data-ui>` (set by `useApplyUiVariant` once the variant's stylesheet
  `src/ui-variants/<id>.css` has loaded — a lazy chunk, fonts self-hosted, latin subsets only);
  its tokens override palette/accent. Every rule is under `:root[data-ui="<id>"]` and targets
  `data-part` hooks (`shell`, `header`, `menu`, `menu-item`, `topnav-tab`, `tabbar`, `home`,
  `home-title|week|momentum|columns|list|focus`, `week-day`, `task-row`, `task-check`, `focus`
  (+ `data-active`), `timer`, `board`, `seats`), active nav items carry `aria-current` or
  `data-active`. The navigation model per variant (`UI_VARIANTS[id].nav`: `sidebar | rail | top |
  command`, `useNavModel()`, `useMenuDocked()`) is generic: `AppShell.module.css` (`data-nav` on the
  shell sets `--sidebar-w`, and for `top` a taller `--header-h`), `Menu.module.css` (`.undocked`
  drawer on wide screens, `.rail`), `Header` (`TopNav` row, command field). Surface brief:
  `.impeccable/surfaces/src-app-jsx.md`.
- `/fun` — hidden mini-games (word guess, scramble, sequence, stats), reached only via the
  daily line in the header.
- Task sharing: send a task to a friend (`task_shares`), accepted shares appear in their list.
- Task colours: `tasks.color` (8 names, `src/features/tasks/taskColors.js`); rows and chips set
  `data-task-color`, the tones live in `index.css` as `--task-color` per theme. An event without
  its own colour takes its type's.
- Tasks vs. events (`tasks.kind`, `src/features/tasks/kinds.js`): a task is ticked off by hand, an
  event needs a day and is done once it's over — the server ticks it off (every minute, on
  `GET /api/tasks`, on save; repeating ones get their next one), `useEventEnds` reloads the list
  when one ends. `duration_minutes` = a task's planned time (shown against focus time,
  `plannedTime.js`) or an event's length; both set on wheels (`task/DurationWheel.jsx`). Events
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
says "installed" when running standalone, and hides the row everywhere else.

Client-side storage: only `localStorage` (no cookies), plus the service worker's Cache Storage
for the app's own files: `token` (JWT), `accounts` (several accounts on one device:
`[{ username, displayName, token }]`, max 5, `src/features/auth/accounts.js`; switching reloads
the app as the other one, signing out takes over the next remembered account), `language`, `accent`,
`theme`, `palette`, `motion`, `homeLayout`, `showSharedTasks`, `calendarView`, `timerMode`,
`teamSessionId`, `streakNudge` (day of the last streak reminder), `uiVariant` (testers' interface
variant). `public/theme-init.js` applies
the theme before React loads.

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
  reminder mails, 018: group colour, 019: testers + broadcast audience, 020: optional task fields on shared session tasks, 021: profile fields, 022: families — families, family_members, family_tasks, family_messages, 023: events — tasks.kind / event_type_id, event_types, 024: tasks.repeat_left / repeat_skip, event_types.keywords, shared_session_tasks.kind, 025: users.level / avatar_frame / profile_title / showcase_badges / share_activity, shared_time_days, challenge_completions, feed_events, feed_cheers, 026: users.show_online, families.note / note_updated_at / note_updated_by / emoji / color, family_tasks.assignee_id, 027: tester_feedback — per tester and topic rating 1–5 / comment). Tables: users, tasks, groups, task_groups, notes,
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
- Mail via SMTP (Resend, `smtp.resend.com`): verification links, task reminders, contact form and
  feedback to `CONTACT_TO`. Without `SMTP_HOST` mails are only logged. All mails share one HTML
  layout (`utils/mailTemplate.js`: tables + inline styles; user text always through `escapeHtml`).
- Reminder mails: `utils/reminderMails.js` checks every minute (`REMINDER_CHECK_MS`) for open tasks
  with `reminder_email`, computes the start in `users.timezone` (sent by the app via
  `PUT /api/users/locale`, default Europe/Berlin) and mails the owner once per reminder time
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
- CLI: `npm run pro -- list|requests|grant|revoke|decline|admin|unadmin|tester|untester <username>`.
- Tests: `npm test` (`test/api.test.mjs`, node:test, creates/drops its own DB). Extend for every new route.
- Config via `.env` (see `.env.example`): `NODE_ENV`, `DB_*`, `JWT_SECRET` (≥32 chars), `PORT`,
  `CORS_ORIGINS`, `TRUST_PROXY`, `SMTP_*`, `MAIL_FROM`, `CONTACT_TO`, `FRONTEND_URL`.

## Deployment

**Frontend → Cloudflare Workers (static assets)**, configured in `wrangler.jsonc`: worker
`quideyreactmain`, serves `./dist`, SPA fallback (`not_found_handling: single-page-application`),
custom domain `app.quidey.com`. The app stays out of search results: `index.html` has
`robots: noindex`, `dist/_headers` sends `X-Robots-Tag: noindex` on every path, and
`public/robots.txt` allows crawling on purpose (a blocked crawler never sees the noindex). Search
engines get the landing page, which owns `robots.txt` + `sitemap.xml` on quidey.com. The landing page (`quidey_landing`) is its own worker `quidey-landing` on `quidey.com`; it
forwards the old app URLs that used to live there. There is no deploy script in package.json; deploy is
`npm run build` then wrangler (`npx wrangler deploy`).
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
STRATO, Resend) in `src/legal/owner.js`. Any feature touching personal data must update these
texts in the same change.

## Repo extras

`.claude/skills/`, `.agents/skills/`, `.taste-skill/` (design-review reports), `direction/`
(dark-theme design direction screens) are design tooling, not app code.
