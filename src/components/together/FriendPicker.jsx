import styles from '../Together.module.css';
import { getInitials, displayName } from '../../features/helperFunction';

// Friends as toggle chips, for choosing who to invite
export default function FriendPicker({ friends, selected, onChange }) {
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    return (
        <ul className={styles.chips}>
            {friends.map(friend => (
                <li key={friend.id}>
                    <button
                        type="button"
                        className={selected.includes(friend.id) ? styles.chipOn : styles.chip}
                        aria-pressed={selected.includes(friend.id)}
                        onClick={() => toggle(friend.id)}
                    >
                        <span className={styles.chipAvatar} aria-hidden="true">{getInitials(displayName(friend))}</span>
                        {displayName(friend)}
                    </button>
                </li>
            ))}
        </ul>
    );
}
