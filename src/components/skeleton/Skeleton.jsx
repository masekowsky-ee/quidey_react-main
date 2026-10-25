import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './Skeleton.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchAccess, logout } from '../../features/auth/authAction';

// One grey shape where text or a picture will be (w / h: any CSS length)
export function Bone({ w, h, round = false, className = '', style }) {
    return <span className={`${round ? styles.round : styles.bone} ${className}`} style={{ width: w, height: h ?? (round ? w : undefined), ...style }} />;
}

// Wraps skeleton shapes: busy for assistive tech, which hears "Loading…" instead of the shapes
export function Skeleton({ as: Tag = 'div', className = '', children, ...rest }) {
    const { t } = useTranslation();
    return (
        <Tag className={`${styles.wrap} ${className}`} aria-busy="true" {...rest}>
            <span className={styles.srOnly} role="status">{t('loading')}</span>
            <div aria-hidden="true" style={{ display: 'contents' }}>{children}</div>
        </Tag>
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

function PageBody() {
    return (
        <>
            <Bone className={styles.title} />
            <div className={styles.card}>
                <Bone w="9rem" h="1.1rem" />
                <SkeletonRows count={4} />
            </div>
            <div className={styles.card}>
                <Bone w="7rem" h="1.1rem" />
                <Bone w="100%" h="6rem" />
            </div>
        </>
    );
}

// A page inside the app while its code is on its way
export function PageSkeleton() {
    return <Skeleton className={styles.page}><PageBody /></Skeleton>;
}

// Outside the app (sign-in, verifying the mail): one centered card with a form
export function GateSkeleton() {
    return (
        <Skeleton as="main" className={styles.gate}>
            <div className={styles.card}>
                <Bone w="8rem" h="1.75rem" />
                <Bone w="70%" />
                <Bone className={styles.field} w="100%" />
                <Bone className={styles.field} w="100%" />
                <Bone className={styles.field} w="100%" style={{ marginTop: '0.5rem' }} />
            </div>
        </Skeleton>
    );
}

const SLOW_MS = 5000;

// The app's frame while the server hasn't said yet whether I may use it. When the answer takes
// long (server down, bad connection) it says so and offers to try again or sign out.
export function AppSkeleton() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [slow, setSlow] = useState(false);
    const [retrying, setRetrying] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setSlow(true), SLOW_MS);
        return () => clearTimeout(id);
    }, []);
    const retry = async () => {
        setRetrying(true);
        await dispatch(fetchAccess()).catch(() => {});
        setRetrying(false);
    };
    return (
        <div className={`${styles.shell} ${styles.wrap}`} aria-busy="true">
            <span className={styles.srOnly} role="status">{t('loading')}</span>
            <div className={styles.header} aria-hidden="true">
                <Bone className={styles.brand} w="6rem" h="1.25rem" />
                <span />
                <div className={styles.headerEnd}>
                    <Bone w="3.5rem" h="1.75rem" style={{ borderRadius: '999px' }} />
                    <Bone round w="2rem" />
                </div>
            </div>
            <div className={styles.sidebar} aria-hidden="true">
                <div className={styles.sidebarHead}><Bone w="6rem" h="1.25rem" /></div>
                {[7, 6, 8.5, 5.5, 4.5].map(w => (
                    <div key={w} className={styles.navItem}><Bone w="1.25rem" h="1.25rem" /><Bone w={`${w}rem`} /></div>
                ))}
            </div>
            <div className={styles.page}>
                {slow && (
                    <p className={styles.slow}>
                        {t('betaConnecting')}
                        <button type="button" className={styles.slowBtn} onClick={retry} disabled={retrying}>{t('betaRetry')}</button>
                        <button type="button" className={styles.slowBtn} onClick={() => dispatch(logout())}>{t('logout')}</button>
                    </p>
                )}
                <div aria-hidden="true" style={{ display: 'contents' }}><PageBody /></div>
            </div>
            <div className={styles.tabbar} aria-hidden="true">
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className={styles.tab}><Bone w="1.4rem" h="1.4rem" /><Bone w="2.5rem" h="0.6rem" /></div>
                ))}
            </div>
        </div>
    );
}
