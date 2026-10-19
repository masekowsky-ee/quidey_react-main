import { useId } from 'react';

// The Quidey logo: a Q whose tail is a checkmark, on no background, in the accent color
// chosen in the settings ("Abendrot" by default). The short arm of the check cuts a gap
// into the ring (a mask), the long arm stays clear of it.
// Same drawing as the favicon (public/quidey-logo.svg, recolored by features/settings/favicon.js).
const LOGO_COLOR = 'var(--primary, #fb923c)';

export default function Logo({ className, title }) {
    // ids from useId can hold characters that break url(#...)
    const id = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    return (
        <svg className={className} viewBox="9 5 50 50" role={title ? 'img' : undefined}
            aria-label={title} aria-hidden={title ? undefined : 'true'}>
            <defs>
                {/* the ring gets a gap where the short arm of the check passes */}
                <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                    <rect width="64" height="64" fill="#fff" />
                    <path d="M27 32l9 12" stroke="#000" strokeWidth="10.5" strokeLinecap="round" />
                </mask>
            </defs>
            {/* a CSS variable only works in style, not in the stroke attribute */}
            <circle cx="25" cy="27" r="12" fill="none" style={{ stroke: LOGO_COLOR }} strokeWidth="6" mask={`url(#${id}-cut)`} />
            <path d="M27 32l9 12L54 24" fill="none" style={{ stroke: LOGO_COLOR }} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
