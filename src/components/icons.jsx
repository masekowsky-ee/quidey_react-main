// Outline icons on a 24px grid, drawn with the current text color: the app's one icon set
// (navigation, tutorial, task rows, focus panel, timer)
const PATHS = {
    home: <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8.5z" />,
    calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" /></>,
    profile: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.6 3.8-5.8 7.5-5.8s6.7 2.2 7.5 5.8" /></>,
    history: <path d="M4 20V11M10 20V5M16 20v-6M21 20H3" />,
    social: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 14.3c3 .1 5.5 2.3 5.5 5.7" /></>,
    together: <><circle cx="8" cy="12" r="5" /><circle cx="16" cy="12" r="5" /></>,
    family: <><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5z" /><path d="M12 17.5l-2.7-2.6a1.7 1.7 0 0 1 2.7-2.1 1.7 1.7 0 0 1 2.7 2.1L12 17.5z" /></>,
    admin: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6L12 3z" /><path d="M9 12l2 2 4-4.5" /></>,
    settings: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
    tutorial: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 16.8v.2" /></>,
    tasks: <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5L5.5 14 8 11.5M4 18.5L5.5 20 8 17.5M11 7h9M11 13h9M11 19h9" />,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5M19 6l1.5-1.5" /></>,
    inbox: <><path d="M3.5 13.5l2.6-7.2A1.5 1.5 0 0 1 7.5 5.3h9a1.5 1.5 0 0 1 1.4 1l2.6 7.2V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18v-4.5z" /><path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5" /></>,
    feedback: <><path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5v-3.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" /><path d="M8.5 10.5h7M8.5 13h4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h10M18 15l1 2 2 .5-2 .5-1 2-1-2-2-.5 2-.5 1-2z" />,
    more: <><circle cx="5.5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18.5" cy="12" r="1" /></>,

    // actions (task rows, the focus panel, the timer)
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    edit: <><path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5z" /><path d="M12.5 7.5l4 4" /></>,
    trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /><path d="M10.5 11v5M13.5 11v5" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    chevronDown: <path d="M6.5 9.5L12 15l5.5-5.5" />,
    drag: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
    focus: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
    release: <path d="M9 7.5L5 11.5l4 4M5 11.5h9.5a4.5 4.5 0 0 1 0 9H11" />,
    play: <path d="M8 5.5v13l10.5-6.5L8 5.5z" />,
    pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
    stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
    eye: <><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
    eyeOff: <><path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.5M6.4 7.4C3.9 9.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.4-1.1" /><path d="M10 10a2.8 2.8 0 0 0 4 4M3.5 3.5l17 17" /></>,
    note: <><path d="M6 4.5h8.5L18 8v11.5H6v-15z" /><path d="M14 4.5V8.5h4M9 12.5h6M9 15.5h4" /></>,
    repeat: <path d="M17 3.5l3 3-3 3M20 6.5H8.5A4.5 4.5 0 0 0 4 11v.5M7 20.5l-3-3 3-3M4 17.5h11.5A4.5 4.5 0 0 0 20 13v-.5" />,
    switch: <><circle cx="9" cy="8.5" r="3.5" /><path d="M3 20c.7-3.2 3.2-5.2 6-5.2 1.3 0 2.5.4 3.5 1.1M16 12.5l3-3-3-3M19 9.5h-5M15.5 21.5l-3-3 3-3M12.5 18.5h6.5" /></>,
    logout: <><path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" /><path d="M14.5 8l4 4-4 4M18.5 12H9.5" /></>,
    sprout: <path d="M12 20.5V12M12 12c0-3.6-2.6-6.2-6.8-6.2 0 3.6 2.6 6.2 6.8 6.2zM12 14.5c0-3.1 2.1-5.7 6.2-5.7 0 3.1-2.1 5.7-6.2 5.7z" />,
    peak: <path d="M2.5 19.5l7-11.5 3.6 6 2.1-3.2 6.3 8.7H2.5zM7.6 11.3l1.9 1.7 1.8-1.6" />,
    flame: <path d="M12 21c-3.7 0-6.2-2.5-6.2-5.8 0-3.4 2.7-5.2 3.7-8.7.4 1.9 1.4 3.1 2.5 3.7.3-2.7 1.4-5.2 3.5-6.8-.4 3.1 2.7 5.8 2.7 9.7 0 4.4-2.7 7.9-6.2 7.9z" />,
    star: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5z" />,
    // notifications on this device (settings, the question after the first task)
    bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" /></>,
    sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M5.5 18.5l1.6-1.6M16.9 7.1l1.6-1.6" /></>,
    moon: <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z" />,
    tag: <><path d="M4 4.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-4.6 4.6a1.5 1.5 0 0 1-2.1 0L4.5 11.2V4.5H4z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
    // the Tester page: a lab flask
    flask: <><path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.2a1.5 1.5 0 0 0 1.3 2.3h11.4a1.5 1.5 0 0 0 1.3-2.3l-5.5-9.5V3.5" /><path d="M7.6 14h8.8" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
    arrowRight: <path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" />,
    download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
    // the Fokusraum, Pomodoro, routines, notes
    expand: <path d="M14.5 4.5h5v5M19.5 4.5L13 11M9.5 19.5h-5v-5M4.5 19.5L11 13" />,
    skip: <path d="M6 5.5l9 6.5-9 6.5v-13zM18 5.5v13" />,
    coffee: <><path d="M5 9.5h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-5z" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v3M12 3.5v3" /></>,
    sound: <><path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5v-5z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
    soundOff: <><path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5v-5z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
    routine: <><path d="M5 7.5h1.5M5 12h1.5M5 16.5h1.5M10 7.5h9M10 12h9M10 16.5h5" /><path d="M17 15l1.8 1.8L21.5 14" /></>,
    pin: <path d="M14.5 3.5l6 6-3 1.5-3.5 3.5-.5 4-3-3-5 5M9.5 12l-3-3 4-.5 3.5-3.5 1.5-3" />,
    link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="9.5" r="1.6" /><path d="M20.5 15.5l-5-5-9 9" /></>,
    checklist: <><rect x="4" y="4.5" width="5" height="5" rx="1" /><rect x="4" y="14.5" width="5" height="5" rx="1" /><path d="M5.5 17l1 1 2-2.2M12 7h8M12 17h8" /></>,
    brain: <><path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 7 17.5a3 3 0 0 0 5 1.5V6a3 3 0 0 0-3-1.5z" /><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-3 4.8 3 3 0 0 1-5 1.5" /></>,
    lightbulb: <><path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6v-.5c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3.5z" /></>,
};

// size: width and height in px; without it, CSS (className) decides
export default function Icon({ name, className, strokeWidth = 1.7, size }) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}
