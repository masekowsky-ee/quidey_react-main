// Texts of the quick ways through the app: the command bar for everybody (search tasks, jump,
// do), the keyboard shortcuts and their overview, undoing a tick, and the quick entry in the
// new-task form ("morgen 14 Uhr !hoch"). Merged into translations.js (same keys in both
// languages, checked by translate.test.js).
const flowTexts = {
    de: {
        // ---------- command bar ----------
        commandSearch: 'Suchen',
        commandGroupTasks: 'Aufgaben',
        commandTaskNoDay: 'ohne Tag',
        commandThemeLight: 'Helles Design',
        commandThemeDark: 'Dunkles Design',
        commandShortcuts: 'Tastenkürzel anzeigen',

        // ---------- keyboard shortcuts ----------
        shortcutsTitle: 'Tastenkürzel',
        shortcutsIntro: 'Überall in Quidey, solange du nicht gerade tippst.',
        shortcutsThen: 'dann',
        shortcut_new: 'Neue Aufgabe oder Termin',
        shortcut_search: 'Suchen, springen, tun',
        shortcut_help: 'Diese Übersicht',
        shortcut_goHome: 'Zu Start',
        shortcut_goCalendar: 'Zum Kalender',
        shortcut_goCommunity: 'Zur Gemeinschaft',
        shortcut_goInbox: 'Zum Postfach',
        shortcut_goStats: 'Zu den Statistiken',

        // ---------- undo ----------
        taskDoneToast: '„{name}“ erledigt',
        toastUndo: 'Rückgängig',

        // ---------- quick entry in the new-task form ----------
        quickAddFound: 'Erkannt: {what}',
        quickAddName: '· gespeichert als „{name}“',
        quickAddIgnore: 'Ignorieren',
        quickAddAt: '{time} Uhr',
        quickAddPrio_high: 'Priorität hoch',
        quickAddPrio_medium: 'Priorität mittel',
        quickAddPrio_low: 'Priorität niedrig',
        quickAddTip: 'Tipp: „morgen 14 Uhr !hoch“ in den Namen schreiben trägt Tag, Uhrzeit und Priorität ein.',
    },
    en: {
        // ---------- command bar ----------
        commandSearch: 'Search',
        commandGroupTasks: 'Tasks',
        commandTaskNoDay: 'no day',
        commandThemeLight: 'Light theme',
        commandThemeDark: 'Dark theme',
        commandShortcuts: 'Show keyboard shortcuts',

        // ---------- keyboard shortcuts ----------
        shortcutsTitle: 'Keyboard shortcuts',
        shortcutsIntro: 'Anywhere in Quidey, while you are not typing.',
        shortcutsThen: 'then',
        shortcut_new: 'New task or event',
        shortcut_search: 'Search, jump, do',
        shortcut_help: 'This overview',
        shortcut_goHome: 'Go to Home',
        shortcut_goCalendar: 'Go to the calendar',
        shortcut_goCommunity: 'Go to Community',
        shortcut_goInbox: 'Go to the inbox',
        shortcut_goStats: 'Go to statistics',

        // ---------- undo ----------
        taskDoneToast: '“{name}” done',
        toastUndo: 'Undo',

        // ---------- quick entry in the new-task form ----------
        quickAddFound: 'Found: {what}',
        quickAddName: '· saved as “{name}”',
        quickAddIgnore: 'Ignore',
        quickAddAt: 'at {time}',
        quickAddPrio_high: 'high priority',
        quickAddPrio_medium: 'medium priority',
        quickAddPrio_low: 'low priority',
        quickAddTip: 'Tip: writing “tomorrow 2pm !high” into the name sets the day, time and priority.',
    },
};

export default flowTexts;
