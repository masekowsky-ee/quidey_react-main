import styles from './Header.module.css';
import {Link} from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setShowMenu } from '../features/settings/settingsAction'
import { selectTimerProgress } from '../features/session/sessionAction'
import TeamWorkPill from './together/TeamWorkPill'
import TeamQuickPanel from './together/TeamQuickPanel'
import DailyTicker from './DailyTicker'
import Logo from './Logo'

function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${h}:${mmss}` : mmss;
}

export default function Header(props){
    const {activeTimer} = props;
    const percentWidth = useSelector(selectTimerProgress);
    const dispatch = useDispatch();
    const showMenu = () => {
        dispatch(setShowMenu());
    }
    const token = useSelector((state) => state.auth.token);
    const timer = useSelector((state) => state.session.timer);
    return (
        <div className={styles.header}>
            {token && <>
                <div className={styles.div}>
                    <button onClick={()=>showMenu()} className={styles.btn}>
                        <svg className={styles.svg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M160-240q-17 0-28.5-11.5T120-280q0-17 11.5-28.5T160-320h640q17 0 28.5 11.5T840-280q0 17-11.5 28.5T800-240H160Zm0-200q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h640q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H160Zm0-200q-17 0-28.5-11.5T120-680q0-17 11.5-28.5T160-720h640q17 0 28.5 11.5T840-680q0 17-11.5 28.5T800-640H160Z"/></svg>
                    </button>
                    <Link to="/" className={styles.brand} aria-label="Quidey">
                        <Logo className={styles.brandMark} />
                        <span className={styles.brandText}>Quidey</span>
                    </Link>
                    <div className={styles.center}>
                        {activeTimer &&
                            <div className={styles.timerChip} title={timer.active ? 'running' : 'paused'}>
                                <span className={`${styles.timerDot} ${timer.active ? styles.timerDotLive : ''}`}></span>
                                <span className={styles.timerTime}>{formatTime(timer.time)}</span>
                                <div className={styles.timerTrack}>
                                    <div className={styles.timerFill} style={{width: `${percentWidth}%`}}></div>
                                </div>
                            </div>}
                        <TeamWorkPill />
                    </div>
                    <div className={styles.end}>
                        <TeamQuickPanel />
                        <Link to="/" className={styles.btn}>
                            <svg className={styles.svg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z"/></svg>
                        </Link>
                    </div>
                </div>
                <DailyTicker />
            </>}
        </div>
    );
}