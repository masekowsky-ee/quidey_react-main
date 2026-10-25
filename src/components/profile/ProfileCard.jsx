import styles from './ProfileParts.module.css';
import ProfileAvatar from './ProfileAvatar';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, formatDate } from '../../features/helperFunction';
import { DEFAULT_BANNER, profileColorAttr } from '../../features/profile/profileOptions';
import { BADGES } from '../../features/profile/badges';
import { tierFor } from '../../features/progress/progress';
import LevelPlant from '../progress/LevelPlant';

// The head of a profile: banner, avatar, names and whatever the person set up.
// `limited`: somebody who isn't a friend; only the names are there, so no banner either.
// `children`: buttons on the right (add friend, message, ...).
export default function ProfileCard({ profile, limited = false, heading: Heading = 'h2', children }) {
    const { t } = useTranslation();
    const name = displayName(profile);
    const showcase = (profile.showcase ?? []).map(id => BADGES.find(badge => badge.id === id)).filter(Boolean);

    return (
        <section className={styles.card} data-task-color={limited ? undefined : profileColorAttr(profile)} aria-label={name}>
            <div className={styles.banner} data-banner={limited ? 'none' : (profile.banner ?? DEFAULT_BANNER)} aria-hidden="true" />
            <div className={styles.body}>
                <div className={styles.top}>
                    {/* a friend's profile: the green dot while they have the app open */}
                    <ProfileAvatar user={limited ? { ...profile, emoji: null, color: null, frame: null } : profile} large
                        presence={profile.relation === 'friend'} />
                    {children && <div className={styles.actions}>{children}</div>}
                </div>
                <div>
                    <Heading className={styles.name}>{name}</Heading>
                    <p className={styles.handle}>
                        @{profile.username}
                        {!limited && profile.title && <span className={styles.titleTag}>{t(`title_${profile.title}`)}</span>}
                    </p>
                </div>
                {!limited && (
                    <>
                        {profile.level > 0 && (
                            <p className={styles.levelLine}>
                                {/* the level plant: how far they have grown */}
                                <LevelPlant level={profile.level} size={40} />
                                <span>
                                    <strong>{fill(t('levelLabel'), { level: profile.level })}</strong> · {t(`tier_${tierFor(profile.level).id}`)}
                                </span>
                            </p>
                        )}
                        {profile.status && <p className={styles.status}>{profile.status}</p>}
                        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
                        {showcase.length > 0 && (
                            <ul className={styles.showcase} aria-label={t('profileShowcase')}>
                                {showcase.map(badge => (
                                    <li key={badge.id}><Icon name={badge.icon} size={16} />{t(`badge_${badge.id}`)}</li>
                                ))}
                            </ul>
                        )}
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
