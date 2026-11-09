import styles from './Stats.module.css';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { hoursText } from '../../features/stats/period';

const placeLink = (place) => (place.kind === 'family' ? `/family/${place.id}` : `/together/${place.id}`);

// "In sessions & families": my team stopwatch time in the period and, per session / family, what
// of mine was done there (tasks I ticked off or that were given to me, events I added or was
// given). Nothing at all: no section. together: the API's { teamMs, places, done }.
export default function TogetherStats({ together }) {
    const { t } = useTranslation();
    if (!together || (together.teamMs === 0 && together.places.length === 0)) return null;
    return (
        <section className={styles.card} aria-labelledby="stats-together">
            <h2 id="stats-together" className={styles.cardTitle}>{t('statsTogether')}</h2>
            <dl className={styles.togetherTime}>
                <dt>{t('statTeamTime')}</dt>
                <dd>{hoursText(together.teamMs)}</dd>
            </dl>
            {together.places.length > 0 &&
                <ul className={styles.places}>
                    {together.places.map(place => (
                        <li key={`${place.kind}-${place.id}`}>
                            <Link to={placeLink(place)} className={styles.place}>
                                <span className={styles.placeName}>{place.emoji ? `${place.emoji} ${place.name}` : place.name}</span>
                                <span className={styles.placeCounts}>
                                    {[
                                        place.done > 0 && fill(t('statTogetherDone'), { count: place.done }),
                                        place.events > 0 && fill(t(place.events === 1 ? 'statTogetherEvent' : 'statTogetherEvents'), { count: place.events }),
                                    ].filter(Boolean).join(' · ')}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>}
        </section>
    );
}
