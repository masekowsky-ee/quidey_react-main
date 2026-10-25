// Texts of the intro tour (components/Tutorial.jsx, tour/TourPreview.jsx). Per step:
// tut_<id>_short (its chapter name), _title, _text and _tips (a list). Merged into
// translations.js (same keys in both languages, checked by translate.test.js).
const tourTexts = {
    de: {
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
        tut_together_text: 'Unter Gemeinschaft findest du alles mit anderen: Feed, Freunde, geteilte Sitzungen und Families. Nachrichten landen im Postfach.',
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
        tut_ready_text_phone: 'Unten erreichst du Start, Kalender, Gemeinschaft und Postfach. Alles Weitere steckt hinter „Mehr“.',
        tut_ready_text_drawer: 'Über den Menü-Knopf links im Header erreichst du alle Seiten, dein Konto und die Einstellungen.',
        tut_ready_text_sidebar: 'Links in der Seitenleiste findest du alle Seiten, unten Einstellungen, Feedback und dein Konto.',
        tut_ready_text_other: 'Alle Seiten erreichst du über die Navigation deiner Oberfläche, Einstellungen und Konto über das Menü.',
        tut_ready_tips: [
            'Etwas fehlt oder hakt? Schreib uns über „Feedback“ im Menü.',
            'Psst: Klick doch mal auf die Glühbirne und das Fenster dahinter.',
        ],
        tut_ready_tester: 'Als Tester findest du im Menü den Testbereich mit neuen Oberflächen zum Ausprobieren.',

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
    },
    en: {
        tutSkip: 'Skip',
        tutBack: 'Back',
        tutNext: 'Next',
        tutDone: "Let's go",
        tutHello: 'Hi {name}!',
        tutOpen: 'Open {page}',
        tutKeys: '← → to browse · Esc closes',
        tutJump: 'Jump straight to a chapter',
        tutNewTask: 'Create your first task',
        tutFindFriends: 'Find friends',
        tutDesignProfile: 'Design your profile',
        tutFirstSteps: 'Your first steps',

        tut_welcome_short: 'Start',
        tut_welcome_title: 'Welcome to Quidey!',
        tut_welcome_text: 'Your planner for learning and studying. In about a minute you will see how planning, focus and studying together fit together here.',
        tut_welcome_tips: [
            'Move on with "Next", the arrow keys, or just swipe sideways.',
            'Feel free to skip. You can restart the tour any time under Settings → App.',
        ],

        tut_plan_short: 'Plan',
        tut_plan_title: 'Tasks and events',
        tut_plan_text: '"New" in the header adds something from any page. Only the name is required, add everything else whenever you like.',
        tut_plan_tips: [
            'A task is ticked off by you. An event like a lecture or a shift has a day and is done once it is over.',
            'Set groups, priority, colour, planned time and repeats in the editor.',
            'Reminders show up in the app, and by email if you want.',
        ],

        tut_focus_short: 'Focus',
        tut_focus_title: 'Focus time that counts',
        tut_focus_text: 'Pick a task and start the timer. Every minute is booked onto that task and ends up in your statistics.',
        tut_focus_tips: [
            'Tap the focus icon on a task, or drag it into the "Focus" column.',
            'The timer counts down, the stopwatch counts up. Set the default length in the settings.',
            'The running time stays visible in the header, whichever page you are on.',
        ],

        tut_calendar_short: 'Calendar',
        tut_calendar_title: 'Your week at a glance',
        tut_calendar_text: 'Month, week or agenda: the calendar shows tasks and events together. Just drag an entry onto another day.',
        tut_calendar_tips: [
            'Repeat weekly, monthly or yearly, with an end if you like.',
            'The toolbar switches to the calendars of your shared sessions and families.',
            'Accept tasks your friends share with you here.',
        ],

        tut_grow_short: 'Grow',
        tut_grow_title: 'Streak, XP and your plant',
        tut_grow_text: 'Every day with focus extends your streak. Focus minutes, finished tasks and challenges give XP, and your plant grows with every level.',
        tut_grow_tips: [
            '1 XP per focus minute and 5 per finished task, plus three challenges a day and two a week.',
            'Every level unlocks more for your profile: emojis, colours, banners, frames and titles.',
            'The flame in the header shows your streak. It burns once today counts.',
        ],

        tut_together_short: 'Together',
        tut_together_title: 'Study with friends',
        tut_together_text: 'Community holds everything with other people: the feed, friends, shared sessions and families. Messages land in your inbox.',
        tut_together_tips: [
            'Sessions: one shared task list, a stopwatch for everyone and a chat, all live.',
            'Family: a fixed group with a shared calendar, a board and its own chat.',
            'Cheer friends on in the feed. A green dot shows who is online right now; whether you show up like that is up to you in your profile.',
        ],

        tut_stats_short: 'Look back',
        tut_stats_title: 'See what you got done',
        tut_stats_text: 'Your statistics show your focus time and how long your events took, per week, month, year or all time.',
        tut_stats_tips: [
            'Give events a type like "Work": then you see e.g. "32 h Work" for the month.',
            'The arrows take you back week by week or month by month.',
            'Plus a 26-week heat map, your finished tasks and your badges.',
        ],

        tut_yours_short: 'Your style',
        tut_yours_title: 'Make it yours',
        tut_yours_text: 'Try it right here: an accent colour and light or dark. Everything else is in the settings.',
        tut_yours_tips: [
            'Six colour palettes for the ground of the app.',
            'How much motion you like: minimal, normal or extreme.',
            'Install Quidey under Settings → App and it starts like any other app.',
        ],

        tut_ready_short: 'Go',
        tut_ready_title: 'Always at hand',
        tut_ready_text_phone: 'Home, calendar, community and inbox are at the bottom. Everything else is behind "More".',
        tut_ready_text_drawer: 'The menu button on the left of the header leads to every page, your account and the settings.',
        tut_ready_text_sidebar: 'The sidebar on the left holds every page, with settings, feedback and your account at the bottom.',
        tut_ready_text_other: 'Every page is in the navigation of your interface, settings and account are in the menu.',
        tut_ready_tips: [
            'Something missing or broken? Write to us via "Feedback" in the menu.',
            'Psst: try clicking the light bulb and the window behind it.',
        ],
        tut_ready_tester: 'As a tester you find the test area in the menu, with new interfaces to try.',

        tutDemo_task: 'Summarise chapter 3',
        tutDemo_taskMeta: 'Today · High',
        tutDemo_event: 'Statistics lecture',
        tutDemo_eventMeta: '10:00 · 90 min',
        tutDemo_focusLeft: 'left',
        tutDemo_feed: '2 h 10 min focus today',
        tutDemo_level: 'Level {level}',
        tutDemo_focus: 'Focus',
        tutDemo_events: 'Events',
    },
};

export default tourTexts;
