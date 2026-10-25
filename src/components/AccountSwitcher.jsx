import styles from './AccountSwitcher.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { logout } from '../features/auth/authAction';
import { addAnotherAccount, MAX_ACCOUNTS, otherAccounts, switchAccount, listAccounts } from '../features/auth/accounts';
import Icon from './icons';

const initialOf = (name) => (String(name ?? '?').trim()[0] ?? '?').toUpperCase();

// Who is signed in, at the foot of the menu: a tap opens the accounts on this device (one tap
// switches), the profile, "add account" and "sign out". onNavigate: the drawer closes when a
// link is used.
// compact: only the avatar (the narrow rail of a tester variant); the accounts open beside it
export default function AccountSwitcher({ onNavigate, compact = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const user = useSelector(state => state.auth.user);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const menuId = useId();
    const username = user?.username ?? '';
    const name = user?.display_name || username;
    // read when opened: another tab may have signed in an account since
    const others = open ? otherAccounts(username) : [];
    const canAdd = open && listAccounts().length < MAX_ACCOUNTS;

    // closes on a click elsewhere and on Escape (focus back on the button)
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
            wrapRef.current?.querySelector('button')?.focus();
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    if (!username) return null;

    return (
        <div className={`${styles.wrap} ${compact ? styles.compact : ''}`} ref={wrapRef}>
            {open &&
                <div className={styles.menu} id={menuId} role="menu" aria-label={t('accounts')}>
                    <div className={styles.current}>
                        <span className={styles.avatar} aria-hidden="true">{initialOf(name)}</span>
                        <span className={styles.names}>
                            <span className={styles.name}>{name}</span>
                            <span className={styles.handle}>@{username}</span>
                        </span>
                        <Icon name="check" size={18} className={styles.currentMark} />
                    </div>
                    <Link to="/profile" role="menuitem" className={styles.item} onClick={() => { setOpen(false); onNavigate?.(); }}>
                        <Icon name="profile" size={18} />
                        <span>{t('profile')}</span>
                    </Link>
                    {others.length > 0 && <div className={styles.divider} role="separator" />}
                    {others.map(account => (
                        <button key={account.username} type="button" role="menuitem" className={styles.item}
                            onClick={() => switchAccount(account.username)}>
                            <span className={styles.avatarSmall} aria-hidden="true">{initialOf(account.displayName || account.username)}</span>
                            <span className={styles.names}>
                                <span className={styles.name}>{account.displayName || account.username}</span>
                                <span className={styles.handle}>@{account.username}</span>
                            </span>
                        </button>
                    ))}
                    <div className={styles.divider} role="separator" />
                    {canAdd &&
                        <button type="button" role="menuitem" className={styles.item} onClick={addAnotherAccount}>
                            <Icon name="plus" size={18} />
                            <span>{t('accountAdd')}</span>
                        </button>}
                    <button type="button" role="menuitem" className={`${styles.item} ${styles.signOut}`} onClick={() => dispatch(logout())}>
                        <Icon name="logout" size={18} />
                        <span>{others.length > 0 ? `${t('signOut')} (@${username})` : t('signOut')}</span>
                    </button>
                </div>}
            <button type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
                aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(o => !o)}>
                <span className={styles.avatar} aria-hidden="true">{initialOf(name)}</span>
                <span className={styles.names}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.handle}>@{username}</span>
                </span>
                <Icon name="switch" size={18} className={styles.triggerIcon} />
                <span className={styles.srOnly}>{t('accountsOpen')}</span>
            </button>
        </div>
    );
}
