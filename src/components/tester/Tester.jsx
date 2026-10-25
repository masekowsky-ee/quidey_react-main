import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styles from './Tester.module.css';
import Icon from '../icons';
import VariantPreview from './VariantPreview';
import FeedbackFields from './FeedbackFields';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { UI_VARIANTS, UI_VARIANT_IDS, setUiVariant, useUiVariant } from '../../features/tester/variants';
import { TEST_FEATURES, featureTopic, fetchMyTesterFeedback, variantTopic } from '../../features/tester/feedback';

// One interface variant: how it looks, what it is, use it, rate it
function VariantRow({ variant, active, entry, onSaved }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const name = t(`uiVariant_${variant}`);
    return (
        <li className={styles.row} data-active={active || undefined}>
            <VariantPreview variant={variant} />
            <div className={styles.rowMain}>
                <div className={styles.rowHead}>
                    <h3 className={styles.rowTitle}>{name}</h3>
                    {active
                        ? <span className={styles.activeMark}><Icon name="check" size={16} strokeWidth={2.2} />{t('testerUiActive')}</span>
                        : <button type="button" className={styles.useBtn} onClick={() => dispatch(setUiVariant(variant))}
                            aria-label={`${name}: ${t('testerUiUse')}`}>{t('testerUiUse')}</button>}
                </div>
                <p className={styles.rowHint}>{t(`uiVariantHint_${variant}`)}</p>
                <p className={styles.rowMeta}>{fill(t('testerUiNavLabel'), { nav: t(`testerNav_${UI_VARIANTS[variant].nav}`) })}</p>
                <FeedbackFields topic={variantTopic(variant)} name={name} entry={entry} onSaved={onSaved} />
            </div>
        </li>
    );
}

// My variants in the order of my stars (ties keep the list's order); the top one is the favourite
function Comparison({ feedback }) {
    const { t } = useTranslation();
    const rated = UI_VARIANT_IDS
        .map(variant => ({ variant, rating: feedback[variantTopic(variant)]?.rating ?? null }))
        .filter(item => item.rating !== null)
        .sort((a, b) => b.rating - a.rating);
    return (
        <section className={styles.section} aria-labelledby="tester-compare">
            <div className={styles.sectionHead}>
                <h2 id="tester-compare" className={styles.sectionTitle}>{t('testerCompareTitle')}</h2>
                <p className={styles.sectionHint}>{t('testerCompareHint')}</p>
            </div>
            {rated.length < 2
                ? <p className={styles.empty}>{t('testerCompareEmpty')}</p>
                : <ol className={styles.ranking} aria-labelledby="tester-compare">
                    {rated.map(({ variant, rating }) => (
                        <li key={variant} className={styles.rankItem}>
                            <span className={styles.rankName}>{t(`uiVariant_${variant}`)}</span>
                            {rating === rated[0].rating && <span className={styles.favorite}>{t('testerFavorite')}</span>}
                            <span className={styles.rankBar} aria-hidden="true"><span style={{ width: `${(rating / 5) * 100}%` }} /></span>
                            <span className={styles.rankValue}>{fill(t('testerStar'), { count: rating })}</span>
                        </li>
                    ))}
                </ol>}
        </section>
    );
}

// Testers only (the route checks it, the server checks /api/tester again): switch the interface
// variant, rate each variant and each feature in test, say something about it
export default function Tester() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const active = useUiVariant();
    const isAdmin = useSelector(state => state.auth.access.isAdmin);
    // topic -> { rating, comment }; null while loading
    const [feedback, setFeedback] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        dispatch(fetchMyTesterFeedback())
            .then(list => { if (!cancelled) setFeedback(Object.fromEntries(list.map(entry => [entry.topic, entry]))); })
            .catch(() => { if (!cancelled) { setFeedback({}); setLoadFailed(true); } });
        return () => { cancelled = true; };
    }, [dispatch]);

    const onSaved = (entry) => setFeedback(all => ({ ...all, [entry.topic]: entry }));

    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <h1 className={styles.title}>{t('testerTitle')}</h1>
                <p className={styles.intro}>{t('testerIntro')}</p>
                {isAdmin && <Link to="/admin?tab=testers" className={styles.adminLink}>{t('adminTesterFeedback')}<Icon name="arrowRight" size={16} /></Link>}
            </header>
            {loadFailed && <p className={styles.loadError} role="alert">{t('testerLoadFailed')}</p>}

            <section className={styles.section} aria-labelledby="tester-ui">
                <div className={styles.sectionHead}>
                    <h2 id="tester-ui" className={styles.sectionTitle}>{t('testerUiTitle')}</h2>
                    <p className={styles.sectionHint}>{t('testerUiHint')}</p>
                    <p className={styles.note}>{t('testerUiNote')}</p>
                </div>
                <ul className={styles.list} aria-busy={feedback === null}>
                    {UI_VARIANT_IDS.map(variant => (
                        <VariantRow key={variant} variant={variant} active={variant === active}
                            entry={feedback?.[variantTopic(variant)]} onSaved={onSaved} />
                    ))}
                </ul>
            </section>

            {feedback && <Comparison feedback={feedback} />}

            <section className={styles.section} aria-labelledby="tester-features">
                <div className={styles.sectionHead}>
                    <h2 id="tester-features" className={styles.sectionTitle}>{t('testerFeaturesTitle')}</h2>
                    <p className={styles.sectionHint}>{t('testerFeaturesHint')}</p>
                </div>
                <ul className={styles.list}>
                    {TEST_FEATURES.map(({ id, to }) => {
                        const name = t(`testerFeature_${id}`);
                        return (
                            <li key={id} className={`${styles.row} ${styles.featureRow}`}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowHead}>
                                        <h3 className={styles.rowTitle}>{name}</h3>
                                        <Link to={to} className={styles.tryLink}>{t('testerTry')}<Icon name="arrowRight" size={16} /></Link>
                                    </div>
                                    <p className={styles.rowHint}>{t(`testerFeatureHint_${id}`)}</p>
                                    <FeedbackFields topic={featureTopic(id)} name={name} entry={feedback?.[featureTopic(id)]} onSaved={onSaved} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
