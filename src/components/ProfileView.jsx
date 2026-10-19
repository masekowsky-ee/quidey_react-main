import styles from './Profile.module.css';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate, formatDuration, getInitials } from '../features/helperFunction';
import { updateProfile, changePassword, logoutEverywhere } from '../features/auth/authAction';
import { fetchFriends } from '../features/friends/friendsAction';

// Translated message for a profile API error, using the error code the backend sends
function errorText(t, err) {
    const key = `profileError_${err?.code}`;
    const text = t(key);
    return text === key ? t('profileError_generic') : text;
}

const MIN_PASSWORD_LENGTH = 8;

// The signed-in profile: who you are, your numbers, your account details and password
export default function ProfileView({ onSignOut }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const user = useSelector(state => state.auth.user);
    const sessions = useSelector(state => state.session.workedSessionData);
    const friendCount = useSelector(state => state.friends.friends.length);

    // the friends list is otherwise only loaded on the Social page
    useEffect(() => { dispatch(fetchFriends()).catch(() => {}); }, [dispatch]);

    const name = user?.display_name || user?.username;
    const focusMs = sessions.reduce((sum, ws) => sum + (ws.totalTime ?? 0) * 1000, 0);

    // ---------- account details ----------
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ displayName: '', email: '' });
    const [saving, setSaving] = useState(false);
    const [accountMessage, setAccountMessage] = useState(null); // { ok, text }

    const startEditing = () => {
        setForm({ displayName: user?.display_name ?? '', email: user?.email ?? '' });
        setAccountMessage(null);
        setEditing(true);
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setAccountMessage(null);
        try {
            await dispatch(updateProfile(form.displayName.trim(), form.email.trim()));
            setEditing(false);
            setAccountMessage({ ok: true, text: t('profileSaved') });
        } catch (err) {
            setAccountMessage({ ok: false, text: errorText(t, err) });
        } finally {
            setSaving(false);
        }
    };

    // ---------- password ----------
    const emptyPasswords = { current: '', next: '', confirm: '' };
    const [passwords, setPasswords] = useState(emptyPasswords);
    const [changing, setChanging] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState(null); // { ok, text }

    const setPassword = (field) => (e) => {
        setPasswords(prev => ({ ...prev, [field]: e.target.value }));
        setPasswordMessage(null);
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        if (passwords.next.length < MIN_PASSWORD_LENGTH) {
            setPasswordMessage({ ok: false, text: t('profileError_WEAK_PASSWORD') });
            return;
        }
        if (passwords.next !== passwords.confirm) {
            setPasswordMessage({ ok: false, text: t('passwordValidateError') });
            return;
        }
        setChanging(true);
        try {
            await dispatch(changePassword(passwords.current, passwords.next));
            setPasswords(emptyPasswords);
            setPasswordMessage({ ok: true, text: t('passwordChanged') });
        } catch (err) {
            setPasswordMessage({ ok: false, text: errorText(t, err) });
        } finally {
            setChanging(false);
        }
    };

    // sign out on all devices, after a "really?"
    const [confirmEverywhere, setConfirmEverywhere] = useState(false);
    const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
    const signOutEverywhere = async () => {
        setSigningOutEverywhere(true);
        try {
            await dispatch(logoutEverywhere());
        } catch (err) {
            setPasswordMessage({ ok: false, text: errorText(t, err) });
            setSigningOutEverywhere(false);
            setConfirmEverywhere(false);
        }
    };

    const message = (m) => (
        <p className={m ? (m.ok ? styles.success : styles.error) : styles.messageEmpty} role="status" aria-live="polite">
            {m?.text}
        </p>
    );

    return (
        <>
            <h1 className={styles.title}>{t('profile')}</h1>

            <section className={`${styles.card} ${styles.identity}`}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(name)}</div>
                <div className={styles.identityText}>
                    <h2 className={styles.name}>{name}</h2>
                    {user?.username && <p className={styles.handle}>@{user.username}</p>}
                    {user?.created_at && <p className={styles.since}>{t('memberSince')} {formatDate(user.created_at)}</p>}
                </div>
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('stats')}</h2>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{sessions.length}</span>
                        <span className={styles.statLabel}>{t('sessions')}</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{formatDuration(focusMs)}</span>
                        <span className={styles.statLabel}>{t('focusTime')}</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{friendCount}</span>
                        <span className={styles.statLabel}>{t('friends')}</span>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{t('account')}</h2>
                    {!editing && <button className={styles.quietBtn} onClick={startEditing}>{t('editProfile')}</button>}
                </div>
                {editing ? (
                    <form className={styles.form} onSubmit={saveProfile}>
                        <div className={styles.field}>
                            <label htmlFor="editDisplayName">{t('displayName')}</label>
                            <input id="editDisplayName" value={form.displayName} maxLength={50} autoComplete="name"
                                onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))} />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="editEmail">{t('email')}</label>
                            <input id="editEmail" type="email" value={form.email} autoComplete="email"
                                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))} />
                        </div>
                        {message(accountMessage)}
                        <div className={styles.formActions}>
                            <button type="button" onClick={() => setEditing(false)}>{t('cancel')}</button>
                            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? t('saving') : t('save')}</button>
                        </div>
                    </form>
                ) : (
                    <>
                        <dl className={styles.details}>
                            <div className={styles.detailRow}>
                                <dt>{t('displayName')}</dt>
                                <dd>{user?.display_name || '–'}</dd>
                            </div>
                            <div className={styles.detailRow}>
                                <dt>{t('email')}</dt>
                                <dd>{user?.email || '–'}</dd>
                            </div>
                            <div className={styles.detailRow}>
                                <dt>{t('birthDate')}</dt>
                                <dd>{user?.birth_date ? formatDate(user.birth_date) : '–'}</dd>
                            </div>
                        </dl>
                        {accountMessage && message(accountMessage)}
                    </>
                )}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('changePassword')}</h2>
                <form className={styles.form} onSubmit={submitPassword}>
                    {/* hidden username helps password managers update the right entry */}
                    <input type="text" name="username" value={user?.username ?? ''} autoComplete="username" readOnly hidden />
                    <div className={styles.field}>
                        <label htmlFor="currentPassword">{t('currentPassword')}</label>
                        <input id="currentPassword" type="password" value={passwords.current} onChange={setPassword('current')} autoComplete="current-password" />
                    </div>
                    <div className={styles.fieldRow}>
                        <div className={styles.field}>
                            <label htmlFor="newPassword">{t('newPassword')}</label>
                            <input id="newPassword" type="password" value={passwords.next} onChange={setPassword('next')} autoComplete="new-password" />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="confirmNewPassword">{t('passwordValidate')}</label>
                            <input id="confirmNewPassword" type="password" value={passwords.confirm} onChange={setPassword('confirm')} autoComplete="new-password" />
                        </div>
                    </div>
                    <p className={styles.hint}>{t('newPasswordHint')}</p>
                    {message(passwordMessage)}
                    <div className={styles.formActions}>
                        <button type="submit" className={styles.saveBtn}
                            disabled={changing || !passwords.current || !passwords.next || !passwords.confirm}>
                            {t('changePassword')}
                        </button>
                    </div>
                </form>
            </section>

            <div className={styles.signOutRow}>
                <button className={styles.signOutBtn} onClick={onSignOut}>{t('signOut')}</button>
                {confirmEverywhere ? (
                    <span className={styles.confirmEverywhere}>
                        <span>{t('confirmLogoutEverywhere')}</span>
                        <button className={styles.signOutBtn} disabled={signingOutEverywhere} onClick={signOutEverywhere}>{t('logoutEverywhere')}</button>
                        <button className={styles.quietBtn} onClick={() => setConfirmEverywhere(false)}>{t('cancel')}</button>
                    </span>
                ) : (
                    <button className={styles.quietBtn} onClick={() => setConfirmEverywhere(true)} title={t('logoutEverywhereHint')}>
                        {t('logoutEverywhere')}
                    </button>
                )}
            </div>
        </>
    );
}
