# Quidey in Google Play: everything for the Play Console

What to fill in, in the order the Play Console asks. Texts are ready to paste. The app is built
with `npm run bundle` → `android/app/build/outputs/bundle/release/app-release.aab`.

## 0. Before the first upload (one time)

| What | Where | Notes |
|---|---|---|
| Developer account | play.google.com/console | Personal account: Google requires **closed testing with ≥ 12 testers for 14 days** before production access. Your beta testers fit that well. |
| Payments profile (merchant) | Play Console → Settings → Payments profile | Needed to sell subscriptions. As a Kleinunternehmer give your tax status there; Google is the seller to the customer and handles VAT itself. |
| Upload key | `C:\Users\eesge\Quidey\quidey-android-keys\` | Already made. **Back up this folder** (password inside). Use **Play App Signing** (default): Google keeps the app signing key, a lost upload key can be reset. |
| Firebase project | console.firebase.google.com | Add an Android app `com.quidey.app`, download `google-services.json` → `android/app/`. Then Project settings → Service accounts → "Generate new private key" → put the JSON on the server, `FIREBASE_SERVICE_ACCOUNT_FILE=` in the backend `.env`. |
| Google sign-in | console.cloud.google.com (same project as Firebase) | APIs & Services → OAuth consent screen (external, app name Quidey, support mail, links to app.quidey.com/datenschutz and /nutzungsbedingungen). Credentials: **Web application** client (redirect URI `https://app.quidey.com/auth/google`, + `http://localhost:5173/auth/google`) → its id into `VITE_GOOGLE_CLIENT_ID` (web `.env.production.local`, app `.env.android`) and `GOOGLE_CLIENT_IDS` (backend). **Android** clients for `com.quidey.app` with the SHA-1s from `quidey-android-keys/fingerprints.txt` (upload key, debug key) **and the app signing key's SHA-1** from Play Console → App integrity (after the first upload). |
| Subscription product | Play Console → Monetize → Subscriptions | Product id `quidey_pro`, name "Quidey Pro". Base plans: `monthly` (auto-renewing, 1 month, 2,99 €) and `yearly` (auto-renewing, 1 year, 25,00 €). Prices for other countries: let Play convert. Activate both. |
| Play API access for the server | Play Console → Users and permissions → invite the service account (Google Cloud, e.g. the Firebase one) with "View financial data" and "Manage orders and subscriptions" | Its JSON key → `PLAY_SERVICE_ACCOUNT_FILE=` on the server. |
| Real-time notifications | Google Cloud → Pub/Sub: topic `play-billing`, grant `google-play-developer-notifications@system.gserviceaccount.com` "Pub/Sub Publisher"; push subscription to `https://api.quidey.com/api/billing/play-notifications?token=<PLAY_RTDN_TOKEN>`; Play Console → Monetization setup → topic name | `PLAY_RTDN_TOKEN=` (long random) on the server. |
| Stripe (web) | dashboard.stripe.com | Product "Quidey Pro" with prices 2,99 €/month and 25 €/year → `STRIPE_PRICE_MONTHLY/YEARLY`; webhook `https://api.quidey.com/api/billing/stripe-webhook` (events `checkout.session.completed`, `customer.subscription.created/updated/deleted`) → `STRIPE_WEBHOOK_SECRET`; `STRIPE_SECRET_KEY`. Customer portal: allow cancel + switch plan + update payment method. Business settings: no tax collection (§ 19 UStG). |

Then `npm run bundle` again (with `google-services.json` push is built in) and upload.

## 1. Store listing

**App name:** Quidey – Lernplaner & Fokus

**Short description (de, ≤ 80):**
Lernplaner mit Pomodoro-Timer, Kalender, Routinen und Lernen mit Freunden.

**Short description (en, ≤ 80):**
Study planner with a Pomodoro timer, calendar, routines and studying with friends.

**Full description (de):**

> Quidey ist dein Lernplaner für Schule, Studium und Alltag. Eine Sache nach der anderen.
>
> • Aufgaben und Termine – mit Gruppen, Farben, Prioritäten, Wiederholungen und Erinnerungen
> • Fokusraum mit Pomodoro-Timer, Countdown und Stoppuhr – läuft weiter, auch wenn dein Handy aus ist
> • Kalender mit Monats-, Wochen- und Agenda-Ansicht, eigene Event-Typen
> • Routinen: Morgen-, Lern- oder Putzroutine, Schritt für Schritt geführt
> • Notizbuch mit Checklisten, Links und Bildern
> • Zusammen lernen: gemeinsame Sitzungen mit Freunden, live, mit Chat
> • Quidey Family: gemeinsamer Kalender, Pinnwand und Chat für WG, Familie oder Lerngruppe
> • Statistiken, Serien, Level und tägliche Challenges
> • Benachrichtigungen für Erinnerungen, Nachrichten und Einladungen
> • Anmelden mit Google oder E-Mail
>
> Keine Werbung, kein Tracking, Server in Deutschland.
>
> Quidey ist kostenlos. Wer die Entwicklung unterstützen möchte, kann Quidey Pro abonnieren (monatlich oder jährlich). Quidey Pro gibt es nur aus einem Grund: damit Quidey weiterentwickelt werden kann. Kündigen jederzeit in Google Play.
>
> Quidey ist gerade in einer geschlossenen Beta: Nach der Anmeldung kannst du in der App Zugang anfragen – oder mit Quidey Pro sofort loslegen.

**Full description (en):**

> Quidey is your study planner for school, university and everyday life. One thing after another.
>
> • Tasks and events – with groups, colours, priorities, repeats and reminders
> • Focus room with a Pomodoro timer, countdown and stopwatch – keeps running while your phone is off
> • Calendar with month, week and agenda views, your own event types
> • Routines: morning, study or cleaning routine, guided step by step
> • Notebook with checklists, links and pictures
> • Study together: shared live sessions with friends, with chat
> • Quidey Family: a shared calendar, board and chat for flatmates, family or study group
> • Statistics, streaks, levels and daily challenges
> • Notifications for reminders, messages and invites
> • Sign in with Google or email
>
> No ads, no tracking, servers in Germany.
>
> Quidey is free. If you want to support the development, you can subscribe to Quidey Pro (monthly or yearly). Quidey Pro exists for one reason only: so Quidey can keep being developed. Cancel any time in Google Play.
>
> Quidey is in a closed beta right now: after signing up you can ask for access in the app – or start right away with Quidey Pro.

**Graphics:** icon `store/icon-512.png`, feature graphic `store/feature-graphic.png`
(`node scripts/store-graphic.mjs`). **Phone screenshots (2–8, 9:16)**: take them from the app on
a phone (Start, Fokusraum, Kalender, Gemeinschaft, Statistiken, Quidey unterstützen).

**Category:** Education (Bildung) · **Tags:** Lernen, Produktivität, Planer
**Contact:** masekowsky.ee@gmail.com · Website https://quidey.com
**Privacy policy:** https://app.quidey.com/datenschutz

## 2. App content

- **App access:** "All or some functionality is restricted" → give the reviewers a **test account
  with access** (make a user, `npm run pro -- grant <name>` so it has tester access, or `gift`),
  username + password, and the note: "Closed beta; this account has full access."
- **Ads:** No ads.
- **Content rating (IARC questionnaire):** category "Reference, news or educational"/Utility.
  User-generated content: **yes** (users talk to friends: messages, chats, feed posts, profile
  pictures for testers) — users can only talk to people they accepted as friends / invited;
  content can be removed by the admin, accounts can be blocked; no sharing of location; no
  gambling, no violence. Digital purchases: yes (subscription). Expected rating: USK 12 / PEGI 12
  (because of unmoderated chat between users) — answer honestly, the result is computed.
- **Target audience:** 13–15, 16–17, 18+ (Quidey's terms: at least 14). Not designed for children
  under 13, so the Families policy does not apply. Mention in the store text it is for learners.
- **News app:** no. **COVID / health:** no. **Government:** no. **Financial features:** no.
- **Account deletion:** in the app (Profil → Konto löschen) **and** a web link:
  `https://app.quidey.com/profile#delete-account` (sign in, delete) — plus mail to the address
  in the privacy policy for people who can no longer sign in. Data deleted at once; payment
  records are kept as tax law requires (privacy § 7, § 10).

## 3. Data safety

Data is encrypted in transit: **yes**. Users can request deletion: **yes** (in the app and by mail).
No data is shared with third parties for their own purposes (processors don't count as
"sharing"; Stripe / Google Play payments are handled by them as the seller, Quidey receives no
payment details).

| Data type | Collected | Purpose | Optional? |
|---|---|---|---|
| Name (display name) | yes | App functionality, Account management | required |
| Email address | yes | Account management, App functionality (reminder mails) | required |
| User IDs (username, Google account id when signing in with Google) | yes | Account management | required (Google: optional) |
| Other personal info: date of birth | yes | Account management (age ≥ 14) | required |
| Purchase history (Quidey Pro plan, period, status) | yes | App functionality (Pro) | optional |
| Messages (direct messages, session / family chats, feed posts) | yes | App functionality | optional |
| Photos (notebook pictures; profile pictures for testers) | yes | App functionality | optional |
| Other user-generated content (tasks, events, notes, routines) | yes | App functionality | required for the app to be useful |
| Calendar events (the app's own entries, not the phone's calendar) | yes | App functionality | optional |
| App activity: in-app actions (focus sessions, completed tasks, XP) | yes | App functionality (statistics, progress) | — |
| Device or other IDs: push token (FCM) | yes | App functionality (notifications) | optional |
| Location, contacts, health, financial info (card numbers), web history, audio | **no** | | |

Data is not used for advertising or analytics. Language and time zone of the device are sent so
mails and reminders come at the right time (App functionality).

## 4. Policy reminders

- In the app, Quidey Pro is sold **only** through Google Play Billing. The app never shows web
  prices, never mentions Stripe and never links to a web checkout (handled in the code: the Pro
  page checks `isNativeApp()`).
- The subscription's terms (price, renewal, how to cancel) are visible before buying (Pro page)
  and in the store description.
- Before a release: raise `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
- Target SDK 36 (`android/variables.gradle`): Play requires keeping up with the yearly target.
