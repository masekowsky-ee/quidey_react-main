import styles from '../Together.module.css';
import { getInitials, displayName } from '../../features/helperFunction';

// Initials in a circle; `live` adds a green ring (working right now)
export default function Avatar({ user, small = false, live = false }) {
    return (
        <span
            className={`${small ? styles.avatarSmall : styles.avatar} ${live ? styles.avatarLive : ''}`}
            aria-hidden="true"
            title={displayName(user)}
        >
            {getInitials(displayName(user))}
        </span>
    );
}
