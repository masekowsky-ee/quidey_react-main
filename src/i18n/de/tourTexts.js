// Texts of the intro tour (components/Tutorial.jsx, tour/TourPreview.jsx). Per step:
// tut_<id>_short (its chapter name), _title, _text and _tips (a list). Merged into
// translations.js (same keys in both languages, checked by translate.test.js).
export default {
    tutSkip: 'Überspringen',
    tutBack: 'Zurück',
    tutNext: 'Weiter',
    tutDone: "Los geht's",
    tutHello: 'Hallo {name}!',
    tutOpen: '{page} öffnen',
    tutKeys: '← → zum Blättern · Esc schließt',
    tutJump: 'Spring direkt zu einem Kapitel',
    tutNewTask: 'Erste Aufgabe anlegen',
    tutFindFriends: 'Freunde finden',
    tutDesignProfile: 'Profil gestalten',
    tutFirstSteps: 'Deine ersten Schritte',

    tut_welcome_short: 'Start',
    tut_welcome_title: 'Willkommen bei Quidey!',
    tut_welcome_text: 'Dein Planer für Lernen und Studium. In gut einer Minute siehst du, wie Planen, Fokus und gemeinsames Lernen hier zusammenspielen.',
    tut_welcome_tips: [
        'Blättere mit „Weiter“, den Pfeiltasten oder wisch zur Seite.',
        'Überspring die Tour ruhig. Unter Einstellungen → App startest du sie jederzeit neu.',
    ],

    tut_plan_short: 'Planen',
    tut_plan_title: 'Aufgaben und Events',
    tut_plan_text: 'Mit „Neu“ oben im Header legst du von jeder Seite aus etwas an. Nur der Name ist Pflicht, alles andere ergänzt du, wenn du magst.',
    tut_plan_tips: [
        'Eine Aufgabe hakst du selbst ab. Ein Event wie eine Vorlesung oder Schicht hat einen Tag und ist erledigt, sobald es vorbei ist.',
        'Gruppen, Priorität, Farbe, geplante Dauer und Wiederholung stellst du im Editor ein.',
        'Erinnerungen kommen in der App und auf Wunsch auch per E-Mail.',
    ],

    tut_focus_short: 'Fokus',
    tut_focus_title: 'Fokuszeit, die zählt',
    tut_focus_text: 'Nimm dir eine Aufgabe vor und starte den Timer. Jede Minute wird dieser Aufgabe gutgeschrieben und landet in deinen Statistiken.',
    tut_focus_tips: [
        'Tipp bei einer Aufgabe auf das Fokus-Symbol oder zieh sie in die Spalte „Fokus“.',
        'Der Timer zählt herunter, die Stoppuhr hoch. Die Standardlänge legst du in den Einstellungen fest.',
        'Die laufende Zeit bleibt im Header sichtbar, egal auf welcher Seite du bist.',
    ],

    tut_calendar_short: 'Kalender',
    tut_calendar_title: 'Deine Woche im Blick',
    tut_calendar_text: 'Monat, Woche oder Agenda: Im Kalender stehen Aufgaben und Events zusammen. Zieh einen Eintrag einfach auf einen anderen Tag.',
    tut_calendar_tips: [
        'Wiederholungen wöchentlich, monatlich oder jährlich, auf Wunsch mit Ende.',
        'Oben wechselst du zu den Kalendern deiner geteilten Sitzungen und Families.',
        'Aufgaben, die Freunde mit dir teilen, nimmst du hier an.',
    ],

    tut_grow_short: 'Wachsen',
    tut_grow_title: 'Serie, XP und deine Pflanze',
    tut_grow_text: 'Jeder Tag mit Fokus verlängert deine Serie. Fokusminuten, erledigte Aufgaben und Challenges bringen XP, und mit jedem Level wächst deine Pflanze.',
    tut_grow_tips: [
        '1 XP pro Fokusminute und 5 pro erledigter Aufgabe, dazu jeden Tag drei und jede Woche zwei Challenges.',
        'Mit jedem Level schaltest du mehr für dein Profil frei: Emojis, Farben, Banner, Rahmen und Titel.',
        'Die Flamme im Header zeigt deine Serie. Sie brennt, sobald der Tag zählt.',
    ],

    tut_together_short: 'Gemeinsam',
    tut_together_title: 'Lernen mit Freunden',
    tut_together_text: 'Unter Sozial findest du alles mit anderen: Feed, Freunde, geteilte Sitzungen und Families. Nachrichten landen im Postfach.',
    tut_together_tips: [
        'Sitzungen: eine gemeinsame Aufgabenliste, eine Stoppuhr für alle und ein Chat, alles live.',
        'Family: eine feste Gruppe mit gemeinsamem Kalender, Pinnwand und eigenem Chat.',
        'Im Feed feuerst du Freunde an. Ein grüner Punkt zeigt, wer gerade online ist; ob du selbst so erscheinst, stellst du im Profil ein.',
    ],

    tut_stats_short: 'Rückblick',
    tut_stats_title: 'Sieh, was du geschafft hast',
    tut_stats_text: 'Die Statistiken zeigen deine Fokuszeit und die Dauer deiner Events, pro Woche, Monat, Jahr oder insgesamt.',
    tut_stats_tips: [
        'Gib Events einen Typ wie „Arbeit“, dann steht da z. B. „32 h Arbeit“ für den Monat.',
        'Mit den Pfeilen gehst du Woche für Woche oder Monat für Monat zurück.',
        'Dazu eine Heatmap über 26 Wochen, deine erledigten Aufgaben und Abzeichen.',
    ],

    tut_yours_short: 'Dein Stil',
    tut_yours_title: 'Mach es zu deinem',
    tut_yours_text: 'Probier es gleich hier aus: eine Akzentfarbe und hell oder dunkel. Alles Weitere findest du in den Einstellungen.',
    tut_yours_tips: [
        'Sechs Farbpaletten für den Grundton der App.',
        'Wie viel Bewegung du magst: minimal, normal oder extrem.',
        'Unter Einstellungen → App installierst du Quidey, dann startet es wie jede andere App.',
    ],

    tut_ready_short: 'Los',
    tut_ready_title: 'Alles griffbereit',
    tut_ready_text_phone: 'Unten erreichst du Start, Kalender, Fokus und Sozial, das Postfach oben rechts. Alles Weitere steckt hinter „Mehr“.',
    tut_ready_text_drawer: 'Über den Menü-Knopf links im Header erreichst du alle Seiten, dein Konto und die Einstellungen.',
    tut_ready_text_bar: 'Oben in der Leiste erreichst du Start, Kalender, Fokusraum, Sozial, Postfach und Statistiken. Unter „Mehr“ findest du den Rest, dein Konto und die Einstellungen.',
    tut_ready_text_sidebar: 'Links in der Seitenleiste findest du alle Seiten, unten Einstellungen, Feedback und dein Konto.',
    tut_ready_text_other: 'Alle Seiten erreichst du über die Navigation deiner Oberfläche, Einstellungen und Konto über das Menü.',
    tut_ready_tips: [
        'Etwas fehlt oder hakt? Schreib uns über „Feedback“ im Menü.',
        'Psst: Klick doch mal auf die Glühbirne und das Fenster dahinter.',
    ],
    tut_ready_tester: 'Als Tester findest du im Menü den Testbereich mit neuen Oberflächen zum Ausprobieren.',
    // the short tour for visitors without an account (Tutorial.jsx, GUEST_STEPS)
    tut_join_short: 'Konto',
    tut_join_title: 'Bereit zum Loslegen?',
    tut_join_text: 'Mit einem Konto speichert Quidey deine Aufgaben, Termine und Fokuszeiten, und du findest alles auf jedem Gerät wieder.',
    tut_join_tips: [
        'Anmelden oder registrieren geht in einem Fenster, auch mit Google.',
        'Die Kurzfassung findest du jederzeit im Menü unter „Kurz erklärt“.',
    ],
    tutGuestSignUp: 'Konto erstellen',
    guestInviteTitle: 'Neu hier?',
    guestInviteText: 'In einer Minute siehst du, was Quidey kann.',
    guestInviteOpen: 'Kurz erklärt',
    guestInviteLater: 'Nicht jetzt',

    // the made-up examples in the previews
    tutDemo_task: 'Kapitel 3 zusammenfassen',
    tutDemo_taskMeta: 'Heute · Hoch',
    tutDemo_event: 'Vorlesung Statistik',
    tutDemo_eventMeta: '10:00 · 90 Min.',
    tutDemo_focusLeft: 'noch',
    tutDemo_feed: '2 h 10 min Fokus heute',
    tutDemo_level: 'Level {level}',
    tutDemo_focus: 'Fokus',
    tutDemo_events: 'Events',
}
