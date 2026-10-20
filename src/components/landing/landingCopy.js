// The landing page's words, German and English. Kept apart from the app's translations:
// it is one page of marketing copy, written as a whole (see the copy deck in the report).
// Names in the examples (Ben, Cleo, Mathe, ...) are sample content.

const de = {
    nav: { focus: 'Fokus', plan: 'Planen', together: 'Zusammen', faq: 'Fragen', signIn: 'Anmelden', cta: 'Beta-Platz sichern', language: 'English', languageCode: 'en' },
    hero: {
        before: 'Eine Sache',
        after: 'nach der anderen.',
        done: 'Fertig',
        pause: 'Animation anhalten',
        play: 'Animation abspielen',
        slotLabel: 'Ein Fokus-Timer läuft ab, sein Ring wird zum Q, der Haken macht es zum Quidey-Logo.',
        sub: 'Quidey ist dein ruhiger Planer: Aufgaben, Fokus-Timer und Kalender in einer App, und Freunde, mit denen du gemeinsam lernst.',
    },
    features: [
        {
            id: 'focus',
            heading: 'Eine Aufgabe im Fokus.',
            text: 'Zieh eine Aufgabe ins Fokusfeld und starte den Timer. Quidey zählt mit, wie lange du daran sitzt, und hakt sie mit dir ab.',
            ui: { label: 'Im Fokus', task: 'Deine Aufgabe', session: 'In dieser Sitzung', notes: 'Notizen', note: 'Gedanken festhalten, ohne den Fokus zu verlieren' },
        },
        {
            id: 'plan',
            heading: 'Die Woche auf einen Blick.',
            text: 'Termine mit Uhrzeit, Erinnerungen vorher und Aufgaben, die sich jede Woche, jeden Monat oder jedes Jahr von selbst wiederholen.',
            ui: { today: 'Heute', weekdays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], chips: ['Lernen', 'Sport', 'Termin', 'Projekt', 'Lesen'], repeat: 'Wiederholt sich', reminder: 'Erinnerung' },
        },
        {
            id: 'together',
            heading: 'Zusammen lernen, live.',
            text: 'Starte eine Sitzung mit Freunden. Jeder arbeitet an seinem, eine Stoppuhr zählt für alle, und am Ende seht ihr, was geschafft ist.',
            ui: { title: 'Gemeinsame Sitzung', live: 'arbeitet gerade', pause: 'Pause', tasks: ['Aufgabe', 'Aufgabe', 'Pause'], done: 'erledigt' },
        },
        {
            id: 'style',
            heading: 'Ganz nach deinem Stil.',
            text: 'Deine Lieblingsfarbe, helles oder dunkles Design und Animationen von ganz ruhig bis extrem. Probier eine Farbe aus.',
            ui: { colours: 'Farbthema', theme: 'Design', themes: ['Dunkel', 'Hell', 'System'], motion: 'Animationen', motions: ['Minimal', 'Normal', 'Extrem'], names: { sunset: 'Abendrot', green: 'Grün', ocean: 'Ozean', rose: 'Rose', gold: 'Gold' } },
        },
    ],
    faq: {
        heading: 'Was du noch wissen willst',
        items: [
            ['Was kostet Quidey?', 'Während der Beta nichts. Es gibt kein Bezahlsystem, also kann auch nichts automatisch kostenpflichtig werden.'],
            ['Warum eine geschlossene Beta?', 'Damit ich jede Rückmeldung lesen und Fehler schnell beheben kann. Du legst ein Konto an, sagst in einem Satz, wofür du Quidey nutzen willst, und ich schalte dich frei.'],
            ['Was passiert mit meinen Daten?', 'Sie liegen auf einem Server bei STRATO in Deutschland. Keine Werbung, kein Tracking, keine Cookies. Im Profil kannst du dein Konto jederzeit löschen, mit allem, was dazugehört.'],
            ['Gibt es eine App fürs Handy?', 'Quidey läuft im Browser, auf dem Handy genauso wie am Rechner. Du kannst die Seite zu deinem Startbildschirm hinzufügen, dann öffnet sie sich wie eine App.'],
        ],
    },
    cta: {
        heading: 'Neu hier?',
        placeholder: 'deine@mail.de',
        emailLabel: 'Deine E-Mail-Adresse',
        button: 'Los',
        note: 'Mit deiner Mail legst du gleich unten ein Konto an.',
    },
    start: { heading: 'Dein Konto' },
    footer: {
        invitation: 'Fang mit einer Sache an.',
        button: 'Beta-Platz sichern',
        links: [['Kontakt', '/kontakt'], ['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Nutzungsbedingungen', '/nutzungsbedingungen']],
    },
};

const en = {
    nav: { focus: 'Focus', plan: 'Plan', together: 'Together', faq: 'Questions', signIn: 'Sign in', cta: 'Get a beta spot', language: 'Deutsch', languageCode: 'de' },
    hero: {
        before: 'One thing',
        after: 'after another.',
        done: 'Done',
        pause: 'Pause animation',
        play: 'Play animation',
        slotLabel: 'A focus timer runs down, its ring becomes the Q, and the check turns it into the Quidey logo.',
        sub: 'Quidey is your calm planner: tasks, a focus timer and a calendar in one app, and friends to study with.',
    },
    features: [
        {
            id: 'focus',
            heading: 'One task in focus.',
            text: 'Drag a task into the focus field and start the timer. Quidey counts how long you work on it and ticks it off with you.',
            ui: { label: 'In focus', task: 'Your task', session: 'This session', notes: 'Notes', note: 'Jot thoughts down without losing focus' },
        },
        {
            id: 'plan',
            heading: 'Your week at a glance.',
            text: 'Appointments with a time, reminders before they start, and tasks that repeat every week, month or year on their own.',
            ui: { today: 'Today', weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], chips: ['Study', 'Sport', 'Meeting', 'Project', 'Reading'], repeat: 'Repeats', reminder: 'Reminder' },
        },
        {
            id: 'together',
            heading: 'Study together, live.',
            text: 'Start a session with friends. Everyone works on their own, one stopwatch counts for all of you, and at the end you see what got done.',
            ui: { title: 'Shared session', live: 'working now', pause: 'Break', tasks: ['Task', 'Task', 'Break'], done: 'done' },
        },
        {
            id: 'style',
            heading: 'Made to your taste.',
            text: 'Your favourite colour, a light or dark design, and animations from very calm to extreme. Try a colour.',
            ui: { colours: 'Colour theme', theme: 'Design', themes: ['Dark', 'Light', 'System'], motion: 'Animations', motions: ['Minimal', 'Normal', 'Extreme'], names: { sunset: 'Sunset', green: 'Green', ocean: 'Ocean', rose: 'Rose', gold: 'Gold' } },
        },
    ],
    faq: {
        heading: 'What else you want to know',
        items: [
            ['What does Quidey cost?', 'Nothing during the beta. There is no payment system, so nothing can start costing money on its own.'],
            ['Why a closed beta?', 'So I can read every piece of feedback and fix things fast. You create an account, say in one sentence what you want to use Quidey for, and I let you in.'],
            ['What happens to my data?', 'It sits on a server at STRATO in Germany. No ads, no tracking, no cookies. You can delete your account in your profile at any time, with everything in it.'],
            ['Is there a phone app?', 'Quidey runs in the browser, on your phone just like on your computer. Add it to your home screen and it opens like an app.'],
        ],
    },
    cta: {
        heading: 'New here?',
        placeholder: 'you@mail.com',
        emailLabel: 'Your email address',
        button: 'Go',
        note: 'With your email you create an account right below.',
    },
    start: { heading: 'Your account' },
    footer: {
        invitation: 'Start with one thing.',
        button: 'Get a beta spot',
        links: [['Contact', '/kontakt'], ['Imprint', '/impressum'], ['Privacy', '/datenschutz'], ['Terms', '/nutzungsbedingungen']],
    },
};

export const LANDING_COPY = { de, en };
