import styles from '../Together.module.css';
import { getInitials, displayName } from '../../features/helperFunction';
import { useOnline } from '../../features/presence/presence';
import OnlineDot from '../presence/OnlineDot';
import presenceStyles from '../presence/OnlineDot.module.css';
import { useAvatarUrl } from '../../features/profile/avatars';

// The profile picture (testers) or initials in a circle; `live` adds a green ring (working right now); `presence` a green dot
// while the person has the app open (user.online until the live status is known)
export default function Avatar({ user, small = false, live = false, presence = false }) {
    const online = useOnline(user?.id, user?.online ?? false);
    const picture = useAvatarUrl(user?.id);
    return (
        <span
            className={`${small ? styles.avatarSmall : styles.avatar} ${live ? styles.avatarLive : ''} ${presence ? presenceStyles.host : ''}`}
            aria-hidden="true"
            title={displayName(user)}
        >
            {picture ? <img className={styles.avatarPicture} src={picture} alt="" /> : getInitials(displayName(user))}
            {presence && online && <OnlineDot />}
        </span>
    );
}
