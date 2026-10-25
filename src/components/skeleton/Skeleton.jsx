import { createContext, useContext } from 'react';
import styles from './Skeleton.module.css';
import { useTranslation } from '../../i18n/useTranslation';

// Skeletons: while something loads, its shape is already there (the real classes of the part that
// comes, grey where text and pictures will be), so nothing jumps when it arrives. Labels known up
// front (titles, tabs) stay text. The page-sized ones are in PageSkeletons.jsx, the app's start in
// AppSkeleton.jsx; a part that loads its own data draws its skeleton next to itself.

// One grey shape where text or a picture will be (w / h: any CSS length); round: a circle
// (avatars), pill: a button's or chip's shape
export function Bone({ w, h, round = false, pill = false, className = '', style }) {
    const shape = round ? styles.round : pill ? styles.pill : styles.bone;
    return <span className={`${shape} ${className}`} style={{ width: w, height: h ?? (round ? w : undefined), ...style }} aria-hidden="true" />;
}

// Wraps skeleton shapes: busy for assistive tech, which hears "Loading…" instead of the shapes.
// fade: comes in after a moment, so a quick load never flashes it (not where it replaces another
// skeleton, which would blink).
// inert: nothing in it works yet (whole pages: their tabs and buttons are only shapes); the
// "Loading…" then sits beside it, where it is still heard. One inside another says nothing more.
const Nested = createContext(false);
export function Skeleton({ as: Tag = 'div', className = '', fade = false, inert = false, children, ...rest }) {
    const { t } = useTranslation();
    const nested = useContext(Nested);
    const status = !nested && <span className={styles.srOnly} role="status">{t('loading')}</span>;
    return (
        <Nested.Provider value>
            {inert && status}
            <Tag className={`${fade ? styles.fade : ''} ${className}`} aria-busy={nested ? undefined : 'true'} inert={inert || undefined} {...rest}>
                {!inert && status}
                {children}
            </Tag>
        </Nested.Provider>
    );
}

// A list of people or entries: picture (unless avatar is false), a line, a shorter line
export function SkeletonRows({ count = 3, avatar = true }) {
    return (
        <Skeleton>
            <ul className={styles.rows}>
                {Array.from({ length: count }, (_, i) => (
                    <li key={i}>
                        {avatar && <Bone round w="2.25rem" />}
                        <div className={styles.lines}>
                            <Bone w={`${68 - (i % 3) * 12}%`} h="0.9375rem" />
                            <Bone w="35%" h="0.8125rem" />
                        </div>
                    </li>
                ))}
            </ul>
        </Skeleton>
    );
}
