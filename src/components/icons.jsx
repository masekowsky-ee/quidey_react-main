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
