import styles from './ProfileParts.module.css';
import { displayName, getInitials } from '../../features/helperFunction';
import { profileColorAttr } from '../../features/profile/profileOptions';
import { useOnline } from '../../features/presence/presence';
import OnlineDot from '../presence/OnlineDot';
import presenceStyles from '../presence/OnlineDot.module.css';
import { useAvatarUrl } from '../../features/profile/avatars';

// A person's avatar: their profile picture (testers, see avatars.js), else their emoji, or their
// initials, on their profile colour.
// Works with anything that has { username, displayName, emoji?, color?, frame? } (friends, profiles).
//   size       'large': the frame (unlocked by level) is drawn, on a profile only; 'small': the plain look's small one
//   plain      initials on a neutral circle, no emoji / profile colour (chats, sessions, boards); has a name as title
//   live       a ring: working right now
//   presence   a green dot while they have the app open (user.online until the live status is known)
export default function ProfileAvatar({ user, size, plain = false, live = false, presence = false }) {
    const online = useOnline(user?.id, user?.online ?? false);
    const picture = useAvatarUrl(user?.id);
    const large = size === 'large';
    const look = plain
        ? [size === 'small' ? styles.avatarPlainSmall : styles.avatarPlain, live && styles.avatarLive]
        : [styles.avatar, large && styles.avatarLarge, user?.emoji && styles.avatarEmoji];
    const classes = [...look, presence && presenceStyles.host].filter(Boolean).join(' ');
    return (
        <span className={classes} aria-hidden="true"
            title={plain ? displayName(user) : undefined}
            data-task-color={plain ? undefined : profileColorAttr(user)}
            data-frame={large && !plain ? user?.frame ?? undefined : undefined}>
            {picture ? <img className={styles.avatarPicture} src={picture} alt="" /> : (!plain && user?.emoji) || getInitials(displayName(user))}
            {presence && online && <OnlineDot large={large} />}
        </span>
    );
}
