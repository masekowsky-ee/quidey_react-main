import styles from '../Together.module.css';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import HomeLayoutSwitch from './HomeLayoutSwitch';

// Top of the solo home page: the Solo | Team switch, and a hint when friends are waiting
// for me (invites) or working right now in one of my sessions
export default function SoloTogetherStrip() {
    const { t } = useTranslation();
    const { sessions, invites } = useSelector(state => state.together);
    const live = sessions.filter(s => !s.endedAt && s.workingCount > 0);

    let hint = null;
    if (invites.length > 0) {
        hint = fill(t(invites.length === 1 ? 'stripInviteOne' : 'stripInvites'), { count: invites.length, name: invites[0].name });
    } else if (live.length > 0) {
        hint = fill(t('stripLive'), { count: live.reduce((sum, s) => sum + s.workingCount, 0), name: live[0].name });
    }

    return (
        <div className={styles.soloStrip}>
            {hint
                ? <Link to="/together" className={styles.soloHint}><span className={styles.liveDot} aria-hidden="true" />{hint} →</Link>
                : <span />}
            <HomeLayoutSwitch />
        </div>
    );
}
