import styles from './ProfileParts.module.css';
import { displayName, getInitials } from '../../features/helperFunction';
import { profileColorAttr } from '../../features/profile/profileOptions';

// A person's avatar: their emoji, or their initials, on their profile colour.
// Works with anything that has { username, displayName, emoji?, color? } (friends, profiles).
export default function ProfileAvatar({ user, large = false }) {
    const classes = [styles.avatar, large && styles.avatarLarge, user?.emoji && styles.avatarEmoji].filter(Boolean).join(' ');
    return (
        <span className={classes} data-task-color={profileColorAttr(user)} aria-hidden="true">
            {user?.emoji || getInitials(displayName(user))}
        </span>
    );
}
