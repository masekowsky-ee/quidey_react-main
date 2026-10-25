import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './AdminTesterFeedback.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { showToast } from '../../features/toast/toast';
import { UI_VARIANT_IDS } from '../../features/tester/variants';
import { SkeletonRows } from '../skeleton/Skeleton.jsx';
import { TEST_FEATURES, UI_TOPICS, featureTopic, fetchAllTesterFeedback, variantTopic } from '../../features/tester/feedback';

// For each tester, which variant(s) they gave their most stars: topic -> how many testers
function favouriteCounts(topics) {
    const best = new Map(); // user id -> { rating, topics }
    for (const topic of topics.filter(item => UI_TOPICS.includes(item.topic))) {
        for (const entry of topic.entries) {
            if (entry.rating === null) continue;
            const mine = best.get(entry.user.id);
            if (!mine || entry.rating > mine.rating) best.set(entry.user.id, { rating: entry.rating, topics: [topic.topic] });
            else if (entry.rating === mine.rating) mine.topics.push(topic.topic);
        }
    }
    const counts = {};
    for (const { topics: favourites } of best.values()) {
        for (const topic of favourites) counts[topic] = (counts[topic] ?? 0) + 1;
    }
    return counts;
}

// How the stars of one topic spread: five columns, 1 to 5
function Spread({ spread }) {
    const most = Math.max(1, ...spread);
    return (
        <span className={styles.spread} aria-hidden="true">
            {spread.map((count, i) => (
                <span key={i} className={styles.spreadCol} title={`${i + 1}/5: ${count}`}>
                    <span style={{ height: `${(count / most) * 100}%` }} />
                </span>
            ))}
        </span>
    );
}

function Topic({ name, data, favourites, locale }) {
    const { t } = useTranslation();
    const comments = data?.entries.filter(entry => entry.comment) ?? [];
    return (
        <li className={styles.topic}>
            <div className={styles.topicHead}>
                <h3 className={styles.topicName}>{name}</h3>
                {favourites > 0 && <span className={styles.favourite}>{fill(t('adminTesterFavoriteOf'), { count: favourites })}</span>}
                <span className={styles.average}>
                    {data?.ratings
                        ? fill(t('adminTesterAverage'), { average: data.average.toLocaleString(locale, { maximumFractionDigits: 2 }), count: data.ratings })
                        : data ? t('adminTesterNoRatings') : '–'}
                </span>
                {data?.ratings > 0 && <Spread spread={data.spread} />}
            </div>
            {comments.length > 0 &&
                <ul className={styles.comments}>
                    {comments.map(entry => (
                        <li key={entry.user.id} className={styles.comment}>
                            <span className={styles.commentMeta}>
                                <span className={styles.commentWho}>{displayName(entry.user)}</span>
                                {entry.rating !== null && <span className={styles.commentRating}>{entry.rating}/5</span>}
                                <time dateTime={entry.updatedAt}>{new Date(entry.updatedAt).toLocaleDateString(locale, { dateStyle: 'medium' })}</time>
                            </span>
                            <p className={styles.commentText}>{entry.comment}</p>
                        </li>
                    ))}
                </ul>}
        </li>
    );
}

// The admin panel's tab: what testers said about the interface variants and the features in test
export default function AdminTesterFeedback() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        dispatch(fetchAllTesterFeedback())
            .then(result => { if (!cancelled) setData(result); })
            .catch(() => { if (!cancelled) { setData({ testers: 0, topics: [] }); dispatch(showToast(t('friendError_generic'), 'error')); } });
        return () => { cancelled = true; };
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    if (!data) return <section className={styles.card} role="tabpanel"><SkeletonRows count={4} avatar={false} /></section>;
    if (data.topics.length === 0) return <section className={styles.card} role="tabpanel"><p className={styles.empty}>{t('adminTesterNone')}</p></section>;

    const byTopic = Object.fromEntries(data.topics.map(topic => [topic.topic, topic]));
    const favourites = favouriteCounts(data.topics);
    const known = new Set([...UI_TOPICS, ...TEST_FEATURES.map(feature => featureTopic(feature.id))]);
    const other = data.topics.filter(topic => !known.has(topic.topic));

    return (
        <div className={styles.wrap} role="tabpanel" aria-label={t('adminTesterFeedback')}>
            <p className={styles.summary}>{fill(t('adminTesterSummary'), { count: data.testers })}</p>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('adminTesterVariants')}</h2>
                <ul className={styles.topics}>
                    {UI_VARIANT_IDS.map(variant => (
                        <Topic key={variant} name={t(`uiVariant_${variant}`)} data={byTopic[variantTopic(variant)]}
                            favourites={favourites[variantTopic(variant)] ?? 0} locale={locale} />
                    ))}
                </ul>
            </section>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('adminTesterFeatures')}</h2>
                <ul className={styles.topics}>
                    {TEST_FEATURES.map(({ id }) => (
                        <Topic key={id} name={t(`testerFeature_${id}`)} data={byTopic[featureTopic(id)]} locale={locale} />
                    ))}
                </ul>
            </section>
            {other.length > 0 &&
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('adminTesterOther')}</h2>
                    <ul className={styles.topics}>
                        {other.map(topic => <Topic key={topic.topic} name={topic.topic} data={topic} locale={locale} />)}
                    </ul>
                </section>}
        </div>
    );
}
