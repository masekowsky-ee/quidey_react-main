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
// The frame (unlocked by level) is drawn on the large avatar of a profile only.
// `presence`: a green dot while they have the app open (user.online until the live status is known).
export default function ProfileAvatar({ user, large = false, presence = false }) {
    const online = useOnline(user?.id, user?.online ?? false);
    const picture = useAvatarUrl(user?.id);
    const classes = [styles.avatar, large && styles.avatarLarge, user?.emoji && styles.avatarEmoji, presence && presenceStyles.host].filter(Boolean).join(' ');
    return (
        <span className={classes} data-task-color={profileColorAttr(user)} data-frame={large ? user?.frame ?? undefined : undefined} aria-hidden="true">
            {picture ? <img className={styles.avatarPicture} src={picture} alt="" /> : user?.emoji || getInitials(displayName(user))}
            {presence && online && <OnlineDot large={large} />}
        </span>
    );
}
