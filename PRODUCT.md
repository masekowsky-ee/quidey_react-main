# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app on app.quidey.com, installable as a PWA (manifest, service worker, "Als App" in Settings). There are no native apps; on phones it runs in the browser or from the home screen. The public landing page on quidey.com is a separate static Astro site (`../quidey_landing`).

## Users

Anyone who studies: university students first, but also school pupils, trainees, self-learners and people taking courses. They use Quidey alone to plan their days and weeks and to focus on one task at a time. They also use it with friends, to study side by side live and keep each other going.

Users are German-speaking first (German is the default, English is available). Use is spread across a laptop at the desk and a phone in between.

## Product Purpose

Quidey keeps a person's study life in one place: tasks, a focus timer, a calendar with events and repeats, and friends they study with. It exists so studying feels manageable ("Eine Sache nach der anderen") and less lonely.

Success means people come back daily to plan and focus. They also return to study together: they start shared sessions, see what friends are working on and cheer them on.

## Positioning

The social motivation is the core difference. Shared live study sessions count focus time for everyone in them. A stopwatch runs for the whole group, and the session has a shared task list and a chat. On top of that, the Gemeinschaft area (feed, cheering, daily and weekly challenges, levels and XP that grow from seed to ancient forest) is a central pillar, not an add-on.

The calm promise applies to planning: the task list, focus and calendar stay quiet and uncluttered. All of this is privacy-first, built by one person, and free during the beta.

## Operating Context

- Daily loop: open Home, see today's date, the next 8 days, and today's events and open tasks. Pull one task into focus and run the timer.
- Planning: the calendar has month, week and agenda views, drag-and-drop between days, events with types, reminders (also by mail), and repeats (weekly, monthly or yearly, ending never or after N).
- Together: live shared sessions (members, shared tasks and events, a stopwatch for everyone, an activity feed, chat), direct messages and notifications in Postfach, and friends and profiles (`/u/:username`).
- Gemeinschaft: a feed of friends' focus days, completed challenges, levels and streaks, plus their own posts. Friends can cheer each other on. Levels unlock profile cosmetics (banners, frames, titles, showcase).
- Family (testers only): a fixed group with a shared calendar and its own chat.
- Statistiken: focus and event time per week, month or year, sessions, and completed tasks.
- Access: a closed beta. Users sign up, verify their email, request access with one sentence, and are approved by hand. Testers see unreleased features.

## Capabilities and Constraints

- Stack in use: React 19 + Vite, plain JavaScript, CSS Modules, Redux, react-router, `motion`, Socket.IO; backend Express + PostgreSQL. Full details in `CLAUDE.md`.
- Terminology (German UI): Aufgabe (task, ticked off by hand) vs. Event/Termin (needs a day, done once it is over), Fokus, Sitzung / Gemeinsame Sitzung, Zusammen, Postfach, Gemeinschaft, Statistiken, Family, Beta.
- Motion is the user's choice: minimal, normal or extreme. "Minimal" must be fully usable.
- Strict production CSP: no external scripts, styles, fonts or CDNs, and everything is self-hosted.
- Any feature that touches personal data updates the legal texts (Datenschutzerklärung etc.) in the same change.
- Open: how and when Quidey becomes paid after the beta. Nothing is decided, and no pricing exists.

## Brand Commitments

- Name: Quidey. The wordmark and logo are in `public/icons/` and `../quidey_landing/src/components/Logo.astro`.
- Voice: a personal solo-maker voice ("ich schalte dich frei"). Direct, warm and plain, with informal "du" and gender-inclusive forms ("Freund:innen"). Tagline idea: "Eine Sache nach der anderen." / "Fang mit einer Sache an."
- Privacy is a product promise: no ads, no tracking, no cookies (only localStorage). Data is hosted at STRATO in Germany, and the account can be deleted at any time with everything in it.
- Free during the beta: there is no payment system, and no pricing claims are made.

## Evidence on Hand

- Real copy: the landing page texts in `../quidey_landing/src/copy.js` (de/en), app texts in `src/i18n/translations.js` and `src/i18n/communityTexts.js`, and legal texts in `src/legal/`.
- Assets: the logo and PWA icons in `public/icons/`, and the Remotion intro in `src/components/intro/`.
- Absent, never to be invented: testimonials, user counts, university partnerships, press, ratings, pricing, native apps in app stores.

## Product Principles

1. **Together beats alone.** The social layer (live sessions, cheering, shared progress) is the reason to choose Quidey. It should feel encouraging, never like a competition that shames.
2. **One thing at a time.** Planning and focus surfaces stay calm and uncluttered, and the current task is always the clearest thing on screen.
3. **Privacy is not negotiable.** No ads, tracking or third-party calls, data stays in Germany, and every data change is reflected in the legal texts.
4. **The user sets the intensity.** Motion, theme, accent and how much shared content appears are the user's choice, and the quietest setting is a full product.
5. **A person, not a corporation.** Copy sounds like the one person who builds Quidey: honest about the beta, never inflated.

## Accessibility & Inclusion

- Motion levels down to "minimal" plus reduced-motion support. Keyboard operation (e.g. the calendar's keyboard grid), focus visible on row actions, and touch alternatives for hover-only actions.
- Gender-inclusive German. Both languages stay complete (same keys in de/en, checked by tests).
