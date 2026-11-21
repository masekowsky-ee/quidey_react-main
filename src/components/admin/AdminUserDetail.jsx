import styles from './AdminUserDetail.module.css';
import { useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { localeOf } from '../../i18n/locale';
import { displayName, fill, parseDate } from '../../features/helperFunction';
import Dialog from '../Dialog.jsx';
import Icon from '../icons.jsx';

const NONE = '–';

// Everything the admin list knows about one account, read only. A cross, Escape or a click
// beside it puts it away.
export default function AdminUserDetail({ user, onClose }) {
    const { t, language } = useTranslation();
    const titleId = useId();
    const locale = localeOf(language);
    const date = (value) => {
        const d = parseDate(value);
        return d ? d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
    };
    const dateTime = (value) => {
        const d = parseDate(value);
        return d ? `${date(d)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : null;
    };

    const paid = user.proUntil && new Date(user.proUntil) > new Date();
    const pro = [user.isPro && t('adminProGiftValue'), paid && fill(t('adminProPaidValue'), { date: date(user.proUntil) })].filter(Boolean).join(' · ');
    const maxPaid = user.maxUntil && new Date(user.maxUntil) > new Date();
    const max = [user.isMax && t('adminProGiftValue'), maxPaid && fill(t('adminProPaidValue'), { date: date(user.maxUntil) })].filter(Boolean).join(' · ');
    const roles = [user.isAdmin && t('adminRoleAdmin'), user.isTester && t('adminRoleTester'), user.isOwner && t('adminRoleOwner')].filter(Boolean).join(', ');
    const request = user.request && [
        t(`requestStatus_${user.request.status}`),
        user.request.reason,
        user.request.createdAt && fill(t('adminRequestAsked'), { date: dateTime(user.request.createdAt) }),
        user.request.decidedAt && fill(t('adminRequestDecided'), { date: dateTime(user.request.decidedAt) }),
    ].filter(Boolean).join(' · ');
    const choice = user.usageConsent?.choice;
    const usage = choice === 'granted' || choice === 'denied'
        ? [t(choice === 'granted' ? 'adminAnswerYes' : 'adminAnswerNo'), date(user.usageConsent.at)].filter(Boolean).join(' · ')
        : t('adminNotAsked');

    const fields = [
        ['id', user.id],
        ['signIn', user.signIn ? t(`adminSignIn_${user.signIn}`) : null],
        ['email', user.email && `${user.email}${user.emailVerified == null ? '' : ` · ${t(user.emailVerified ? 'adminEmailVerified' : 'adminEmailNotVerified')}`}`],
        ['created', dateTime(user.createdAt)],
        ['terms', dateTime(user.termsAcceptedAt)],
        ['privacy', dateTime(user.privacyAcceptedAt)],
        ['language', user.language],
        ['timezone', user.timezone],
        ['birth', date(user.birthDate)],
        ['level', user.level],
        ['pro', pro],
        ['max', max],
        ['roles', roles],
        ['request', request],
        ['usage', usage],
        ['avatar', t(user.hasAvatar ? 'adminAnswerYes' : 'adminAnswerNo')],
    ];

    return (
        <Dialog onClose={onClose} labelledBy={titleId} backdropClassName={styles.backdrop} className={styles.dialog}>
            {(dismiss) => (<>
                <div className={styles.head} data-sheet-drag>
                    <div className={styles.who}>
                        <h2 id={titleId} className={styles.title}>{displayName(user)}</h2>
                        <span className={styles.sub}>@{user.username}</span>
                    </div>
                    <button type="button" className={styles.close} onClick={() => dismiss()} aria-label={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <dl className={styles.fields}>
                    {fields.map(([key, value]) => (
                        <div key={key} className={styles.field}>
                            <dt>{t(`adminField_${key}`)}</dt>
                            <dd>{value === null || value === undefined || value === '' ? NONE : value}</dd>
                        </div>
                    ))}
                </dl>
            </>)}
        </Dialog>
    );
}
