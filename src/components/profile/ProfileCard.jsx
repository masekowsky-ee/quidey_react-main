import styles from './ProfileParts.module.css';
import ProfileAvatar from './ProfileAvatar';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, formatDate } from '../../features/helperFunction';
import { DEFAULT_BANNER, profileColorAttr } from '../../features/profile/profileOptions';

// The head of a profile: banner, avatar, names and whatever the person set up.
// `limited`: somebody who isn't a friend; only the names are there, so no banner either.
// `children`: buttons on the right (add friend, message, ...).
export default function ProfileCard({ profile, limited = false, heading: Heading = 'h2', children }) {
    const { t } = useTranslation();
    const name = displayName(profile);

    return (
        <section className={styles.card} data-task-color={limited ? undefined : profileColorAttr(profile)} aria-label={name}>
            <div className={styles.banner} data-banner={limited ? 'none' : (profile.banner ?? DEFAULT_BANNER)} aria-hidden="true" />
            <div className={styles.body}>
                <div className={styles.top}>
                    <ProfileAvatar user={limited ? { ...profile, emoji: null, color: null } : profile} large />
                    {children && <div className={styles.actions}>{children}</div>}
                </div>
                <div>
                    <Heading className={styles.name}>{name}</Heading>
                    <p className={styles.handle}>@{profile.username}</p>
                </div>
                {!limited && (
                    <>
                        {profile.status && <p className={styles.status}>{profile.status}</p>}
                        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
                        {profile.interests?.length > 0 && (
                            <ul className={styles.chips} aria-label={t('profileInterests')}>
                                {profile.interests.map(tag => <li key={tag} className={styles.chip}>{tag}</li>)}
                            </ul>
                        )}
                        <ul className={styles.meta}>
                            {profile.study && <li>🎓 {profile.study}</li>}
                            {profile.memberSince && <li>{t('memberSince')} {formatDate(profile.memberSince)}</li>}
                            {profile.friendsSince && <li>{t('friendsSince')} {formatDate(profile.friendsSince)}</li>}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
}
