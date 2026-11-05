# Wann Quidey benachrichtigt

Stand: 2026-11-05. Bei jeder Änderung an Benachrichtigungen hier mitpflegen.

**Grundregeln**

- Wer selbst etwas tut, wird nie darüber benachrichtigt.
- Bei Familien und Sitzungen bekommen nur **beigetretene** Mitglieder etwas, nie nur Eingeladene.
- Push gibt es nur auf Geräten, auf denen Benachrichtigungen eingeschaltet sind (Einstellungen → App →
  Benachrichtigungen). Dort lässt sich jede Push-Art pro Gerät einzeln an- oder ausschalten.
- Ist die Web-App gerade im Vordergrund, zeigt der Service Worker keinen Push. Ausnahmen sind der Test-Push
  und Safari, dort kommt er immer.
- Ist die Android-App gerade offen, zeigt Android keinen Push (die App hat ihre eigenen Hinweise). Ausnahme
  ist der Test-Push: den zeigt die App selbst an (Plugin `QuideyNotice`).
- In der Android-App hat jede Push-Art einen eigenen Android-Kanal, der sich in Android einzeln stummschalten lässt.
- Zugriff hat nur, wer die App nutzen darf (geschlossene Beta).

## Push-Arten

| Art | Schalter in den Einstellungen | Android-Kanal |
|---|---|---|
| `plan` | Aufgaben und Termine | Aufgaben & Termine |
| `digest` | Dein Tag | Tagesüberblick |
| `messages` | Nachrichten | Nachrichten |
| `social` | Anfragen und Einladungen | Freunde & Einladungen |
| `groups` | Familien und Sitzungen | Familien & Sitzungen |

## Alle Anlässe

| Wann | Wer | Wie | Art / Schalter |
|---|---|---|---|
| Erinnerungszeit einer eigenen Aufgabe / eines eigenen Termins (Minuten vor Beginn; ohne Uhrzeit ab meiner Ganztags-Uhrzeit) | ich | Push; in der offenen App Toast + Ton (bei eingeschaltetem Push nur Toast) | `plan` |
| … dieselbe, wenn an der Aufgabe „Auch per Mail“ an ist | ich (nur Besitzer) | Mail | pro Aufgabe |
| Erinnerungszeit eines **Familien-Eintrags** (Zeitzone und Ganztags-Uhrzeit der Familien-Besitzerin bzw. des Besitzers) | alle beigetretenen Mitglieder | Push, einmal pro Erinnerungszeit | `plan` |
| Mein Fokus-Countdown / eine Pomodoro-Phase endet | ich | Push vom Server (auch bei ausgeschaltetem Handy); in der App Ton + Toast | `plan` |
| Uhrzeit einer Routine | ich | Push + Toast in der App | `plan` |
| Erinnerungen (Tester) | ich | Push (nicht an Geräte, die selbst klingeln); Android-App: Wecker; offene Web-App: Hinweis über die ganze Seite | `plan` |
| Morgens 07:30–11:00 (Ortszeit), wenn heute etwas offen ist | ich | Push „Dein Tag“ | `digest` |
| Direktnachricht | der Freund | Push; Postfach live + Ton | `messages` |
| Freundschaftsanfrage | die angefragte Person | Push | `social` |
| Einladung in eine Sitzung / Familie | die Eingeladenen | Push | `social` |
| Eine Aufgabe wurde mir geteilt | ich | Push; Postfach (Anfragen) | `social` |
| Mir wird eine Sitzungs-Aufgabe zugewiesen | die Person, der sie zugewiesen wird | Postfach-Hinweis + Push | `social` |
| Mir wird ein **Familien-Eintrag** zugewiesen | die Person, der er zugewiesen wird | Postfach-Hinweis + Push | `social` |
| Meldung des Quidey-Teams (Broadcast) | alle bzw. Tester | Postfach-Hinweis + Push | `social` |
| Neue Beta-Anfrage | Admins | Push | `social` |
| Jemand anderes trägt in meiner Familie / Sitzung etwas ein (neu, verschoben oder kopiert) | die anderen beigetretenen Mitglieder | Postfach-Hinweis + Push; dieselbe Person am selben Ort innerhalb von 30 Minuten, solange ungelesen: ein Hinweis („Ann hat 4 Einträge eingetragen“), auf dem Gerät ersetzt der neue Push den alten | `groups` |
| Nachricht im Chat meiner Familie / Sitzung | die anderen beigetretenen Mitglieder | Push (pro Chat ersetzt der neue den alten), kein Postfach-Hinweis | `groups` |
| Jemand feuert mich im Feed an | ich | Toast in der App | — |
| Serie verlängert / Meilenstein, Level-Aufstieg, Challenge geschafft | ich | Toast in der App (+ Konfetti je nach Bewegungs-Stufe) | — |
| Serie heute noch offen, ab 18:00 | ich | Toast in der App, einmal am Tag | — |
| Push-Angebot nach der ersten Aufgabe, Frage nach Installation / Bewertung | ich | Dialog in der App, einmal | — |

## Wo das im Code steckt

- Push-Arten, Texte, Zeitplan: `quidey_react-backend/utils/push.js` (`KINDS`, `TEXTS`, `startPushSchedule`)
- Hinweise zu Familien und Sitzungen (Einträge, Zuweisung in Familien, Chat): `quidey_react-backend/utils/groupNotices.js`
- Erinnerungen per Mail: `quidey_react-backend/utils/reminderMails.js`; Fokus, Routinen, Erinnerungen: `utils/focus.js`
- App: `src/features/pwa/push.js` (`PUSH_KINDS`), `src/features/native/nativePush.js` (`NATIVE_CHANNELS`),
  Postfach-Texte `src/features/inbox/inbox.js` (`noticeView`), Live-Toasts `src/features/inbox/useInboxRealtime.js`
