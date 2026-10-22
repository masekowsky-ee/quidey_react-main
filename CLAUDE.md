# Quidey — project overview

Quidey is a calm planner for students: tasks, a focus timer, a calendar, and friends you study
with live. German-first (de default, en available), currently a **closed beta** — only users
with `is_pro` or `is_tester` (admins always) get into the app. Public site: **quidey.com**.

Two repositories, side by side on this machine:

| Repo | Path | GitHub |
|---|---|---|
| Frontend (this one) | `C:\Users\eesge\quidey_react-main` | masekowsky-ee/quidey_react-main |
| Backend | `C:\Users\eesge\quidey_react-backend` | masekowsky-ee/quidey_react-backend |

`README.md` is still the untouched Vite template; this file is the real description.

## Frontend stack

- React 19 + Vite 8, plain JavaScript (no TypeScript), CSS Modules (most modules
  `composes:` shared classes from `src/components/ui.module.css`), Inter via `@fontsource-variable`.
- State: Redux (`configureStore` + classic reducers/action types + thunks), slices in
  `src/features/rootReducer.js`: `task`, `session`, `auth`, `settings`, `friends`, `together`,
  `toast`, `inbox`.
- Routing: react-router-dom 7 (`BrowserRouter` in `src/main.jsx`).
- Animation: `motion` (Framer Motion) with three user-chosen levels `minimal | normal | extreme`
  (`src/features/settings/motion.js`, `MOTION` presets, confetti `burst`). Remotion
  (`@remotion/player`) renders the intro (`src/components/intro/`, only when the app is opened
  fresh on `/`: not on reload, back/forward or a deep link) and the landing hero loop.
- Realtime: `socket.io-client` (`src/features/realtime/socket.js`, `useRealtime(event, handler)`),
  loaded with a dynamic import only once signed in.
- Icons: one outline set, `src/components/icons.jsx` (`<Icon name size? />`, 24px grid, 1.7
  stroke); the calendar keeps its own `calendar/icons.jsx`. No icon files in `src/assets/`.
- Code splitting: every page except Home is `lazy()` in `App.jsx` (`PAGES`), preloaded when the
  app is idle (`preloadPages`); `LegalFooter` lives in its own file so the legal texts stay
  lazy. `vite.config.js` puts react / router / state / motion in their own long-cached chunks.
- i18n: `src/i18n/translations.js` (de/en dictionaries) + `useTranslation()` → `t(key)`.
  Landing page copy lives separately in `src/components/landing/landingCopy.js`.
- Tests: Vitest + jsdom + Testing Library, all in `src/__tests__/` (`npm test`).
  Lint: ESLint 10 flat config (`npm run lint`).

## How the app is gated (`src/App.jsx`)

Order of checks on every render:
1. `/verify-email` → `VerifyEmail` (works signed in or out).
2. Legal paths (`/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/kontakt`, see
   `src/legal/paths.js`) → `LegalPage`, always public.
3. Not signed in → `Landing` (marketing page with sign-in / sign-up).
4. Signed in, access not checked yet → `AccessPending`; not pro → `/beta` (`BetaGate`, user can
   request beta access).
5. Pro → full app in the frame `AppShell.module.css`: `Header`, `Menu`, `TabBar`, `Toaster`,
   `Tutorial`, animated page routes in `<main>`. Widths (`src/features/layout/breakpoints.js`,
   `useMediaQuery`): ≥1100px the `Menu` is a fixed sidebar and the header starts beside it;
   721–1099px the menu is a drawer behind the header's button; ≤720px a bottom `TabBar` (Start,
   Kalender, Zusammen, Postfach, Mehr → drawer) replaces the header's button. The shell sets
   `--sidebar-w`, `--tabbar-h` and `--page-gutter`; fixed parts (toasts, timer button) and every
   page container use them. The closed drawer is `inert`; `setShowMenu(true|false)` (no argument
   toggles).

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
  title row (today's date as h1, open / due today / overdue, Solo|Team switch), next 8 days
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
  family's calendar (testers); picker in the toolbar. `src/features/calendar/sources.js`
  (`useSharedCalendar`) loads them and routes add/move/edit/delete to their API; DayPanel gets
  `personal={false}` (no groups/reminders/sharing, "von X", delete only with `canRemove`).
- `/family`, `/family/:id` — **Quidey Family, tester only** (`TesterOnly` route + menu entry):
  a fixed group of friends with a shared calendar (entries editable on the page via
  `TaskEditDialog handlers={…}` and in the calendar) and its own chat. Slice `family` in
  `src/features/family/family.js` (list + invites, `useFamilyList` in App), pages in
  `src/components/family/`. API under `/api/tester/families` (backend migration 022).
- `/stats` — **Statistiken** (formerly `/history`, which redirects): tabs Übersicht | Sitzungen |
  Erledigt (`?tab=`), period Woche/Monat/Jahr/Gesamt stepped back with arrows (`?range=&offset=`,
  `src/features/stats/period.js`). Overview from `GET /api/stats?from&to`: tiles, stacked columns
  focus + event time (`stats/TimeChart.jsx`, fixed validated pair blue/orange, table view), bars per
  event type and per group, then the all-time `ProfileStats` ("Aktivität"). Sessions list in
  `stats/SessionList.jsx`, completed tasks in `CompletedTasks.jsx` (events left out).
- `/profile`, `/settings` — profile, password, "sign out everywhere", delete account; language,
  theme (dark/light/system), accent colour (green, ocean, violet, sunset (default), rose, gold —
  also recolours the favicon), motion level, home layout.
- `/social` — friends and friend requests; names link to `/u/:username`, the Add tab can open a
  profile before sending a request.
- Profiles: `/profile` shows my profile card (banner, avatar, status, bio, study, interests),
  "Profil gestalten" (`components/profile/ProfileEditor.jsx`, live preview) and my numbers in short
  (the full statistics are on `/stats`).
  `/u/:username` (`UserProfile.jsx`) shows somebody else: non-friends only see display name and
  username (plus add / accept / withdraw), friends see the whole profile, mutual friends and the
  statistics unless `showStats` is off. Pieces in `src/components/profile/` (`ProfileCard`,
  `ProfileAvatar`, `ProfileStats` — tiles, 26-week heat map, last 14 days, weekdays, top groups,
  badges). Option lists in `src/features/profile/profileOptions.js` (same lists as the API),
  badges are derived from the numbers (`badges.js`, nothing stored).
- `/together`, `/together/:id` — shared live study sessions: members, shared task list, a
  stopwatch counting for everyone, activity feed, session chat (realtime). Session tasks can carry
  the same details as own tasks — day, time, prio, duration, location, link, details, colour — all
  optional (only the name is required), edited by any member via `TaskEditDialog shared={…}`
  (`TaskEditor personal={false}`). Reminders, repeating, groups and sharing stay personal; adding
  an own task copies its details, later edits don't sync back (only `done` does).
- `/inbox` — direct messages between friends + notifications/admin broadcasts (realtime).
  From 1100px the messages tab is split: conversations beside the open one (`?with=<userId>`).
- `/feedback` — feedback form (mailed to the owner).
- `/admin` — only for `isAdmin`: overview, beta requests (approve/decline), users (pro/admin
  toggles), broadcasts, admin action log.
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
  only; today's events sit above it (`task/TodayEvents.jsx`). Events can't be focused, shared into
  sessions or overdue. On phones the week strip has no calendar card (the tab bar has it).

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
for the app's own files: `token` (JWT), `language`, `accent`,
`theme`, `motion`, `homeLayout`, `showSharedTasks`, `calendarView`, `timerMode`, `teamSessionId`. `public/theme-init.js` applies
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
  reminder mails, 018: group colour, 019: testers + broadcast audience, 020: optional task fields on shared session tasks, 021: profile fields, 022: families — families, family_members, family_tasks, family_messages, 023: events — tasks.kind / event_type_id, event_types). Tables: users, tasks, groups, task_groups, notes,
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
  { familyId, message } (to testers' user rooms only). Plain time reports (`/activity` every 30 s, online window 75 s) send nothing unless what the
  others see changed (started / stopped / switched task).
- Mail via SMTP (Resend, `smtp.resend.com`): verification links, task reminders, contact form and
  feedback to `CONTACT_TO`. Without `SMTP_HOST` mails are only logged. All mails share one HTML
  layout (`utils/mailTemplate.js`: tables + inline styles; user text always through `escapeHtml`).
- Reminder mails: `utils/reminderMails.js` checks every minute (`REMINDER_CHECK_MS`) for open tasks
  with `reminder_email`, computes the start in `users.timezone` (sent by the app via
  `PUT /api/users/locale`, default Europe/Berlin) and mails the owner once per reminder time
  (`reminder_mailed_at`). Only the owner can switch it on.
- Profiles: `GET /api/profile` (mine), `PUT /api/profile` (only the fields sent: bio, status,
  study, interests, color, banner, emoji, showStats), `GET /api/profiles/:username` (rate limited
  per account; `relation` self/friend/incoming/outgoing/none decides what is in it). Statistics
  are computed per request (`loadStats`/`summarizeStats`, days in `users.timezone`), never stored.
  `/api/friends` also returns each friend's emoji, colour and status.
- CLI: `npm run pro -- list|requests|grant|revoke|decline|admin|unadmin|tester|untester <username>`.
- Tests: `npm test` (`test/api.test.mjs`, node:test, creates/drops its own DB). Extend for every new route.
- Config via `.env` (see `.env.example`): `NODE_ENV`, `DB_*`, `JWT_SECRET` (≥32 chars), `PORT`,
  `CORS_ORIGINS`, `TRUST_PROXY`, `SMTP_*`, `MAIL_FROM`, `CONTACT_TO`, `FRONTEND_URL`.

## Deployment

**Frontend → Cloudflare Workers (static assets)**, configured in `wrangler.jsonc`: worker
`quideyreactmain`, serves `./dist`, SPA fallback (`not_found_handling: single-page-application`),
custom domain `quidey.com`. There is no deploy script in package.json; deploy is
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
`pg_dump` backups, `CORS_ORIGINS=https://quidey.com`.

## Legal / GDPR

German law applies: Impressum (§ 5 DDG), Datenschutzerklärung (DSGVO), Nutzungsbedingungen,
contact form — all in `src/legal/LegalPage.jsx`, owner details and processors (Cloudflare,
STRATO, Resend) in `src/legal/owner.js`. Any feature touching personal data must update these
texts in the same change.

## Repo extras

`.claude/skills/`, `.agents/skills/`, `.taste-skill/` (design-review reports), `direction/`
(dark-theme design direction screens) are design tooling, not app code.
