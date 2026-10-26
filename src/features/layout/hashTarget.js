import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMotionLevel } from '../settings/motion';

// Scrolls to the part of the page that the address's hash names (/settings#appearance,
// /profile#password), once per visit of that address, also when only the hash changed on the
// page that is already open (the command bar leads there). Checks after every render until the
// part is there: an area switched, data loaded.
export function useHashTarget() {
    const { hash, key } = useLocation();
    const smooth = useMotionLevel() !== 'minimal';
    const reached = useRef(null);
    useEffect(() => {
        if (!hash || reached.current === key) return;
        const target = document.getElementById(hash.slice(1));
        if (!target) return;
        reached.current = key;
        target.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    });
}
