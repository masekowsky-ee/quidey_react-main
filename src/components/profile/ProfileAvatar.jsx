import styles from './ProfileParts.module.css';
import { displayName, getInitials } from '../../features/helperFunction';
import { profileColorAttr } from '../../features/profile/profileOptions';

// A person's avatar: their emoji, or their initials, on their profile colour.
// Works with anything that has { username, displayName, emoji?, color?, frame? } (friends, profiles).
// The frame (unlocked by level) is drawn on the large avatar of a profile only.
export default function ProfileAvatar({ user, large = false }) {
    const classes = [styles.avatar, large && styles.avatarLarge, user?.emoji && styles.avatarEmoji].filter(Boolean).join(' ');
    return (
        <span className={classes} data-task-color={profileColorAttr(user)} data-frame={large ? user?.frame ?? undefined : undefined} aria-hidden="true">
            {user?.emoji || getInitials(displayName(user))}
        </span>
    );
}
