import styles from './Community.module.css';
import LevelCard from './LevelCard';
import Challenges from './Challenges';
import Ranking from './Ranking';

// The progress tab: my level (with what it unlocks), today's and this week's challenges and the
// week among friends. Wide: the level on the left, the rest beside it; narrow: one column.
export default function Progress() {
    return (
        <div className={styles.progress}>
            <div className={styles.progressColumn}>
                <LevelCard />
            </div>
            <div className={styles.progressColumn}>
                <Challenges period="day" />
                <Challenges period="week" />
                <Ranking />
            </div>
        </div>
    );
}
