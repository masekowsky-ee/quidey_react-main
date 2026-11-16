import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { openAuth, takeEmailFromHash } from '../../features/auth/gate';

// Where the landing page sends people (/signin, /signup, with the address as #email=…) and where
// Google's sign-in page sends the browser back (googleReturn): asks the sign-in window to open, once.
// Then on to the start page; googleReturn stays (children: the page behind the window) until Google's answer is read.
export default function GuestEntry({ mode, googleReturn = false, children = null }) {
    const asked = useRef(false);
    useEffect(() => {
        if (asked.current) return;
        asked.current = true;
        openAuth(mode, { email: takeEmailFromHash(), googleReturn });
    }, [mode, googleReturn]);
    return googleReturn ? children : <Navigate to="/" replace />;
}
