import styles from './Feed.module.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { sameDay } from '../../features/helperFunction';
import { FEED_POST_MAX, fetchFeed, fetchMoreFeed, postToFeed } from '../../features/feed/feed';
import { fetchFriends } from '../../features/friends/friendsAction';
import { friendsPath } from '../../features/community/paths';
import FeedEntry from './FeedEntry';

const locale = (language) => (language === 'de' ? 'de-DE' : 'en-GB');

// "Today", "Yesterday", "Monday, 20 October"
function dayLabel(date, t, language, now = new Date()) {
    if (sameDay(date, now)) return t('today');
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (sameDay(date, yesterday)) return t('yesterday');
    return date.toLocaleDateString(locale(language), {
        weekday: 'long', day: 'numeric', month: 'long',
        ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
}

// entries in order, grouped by the day they last changed on
function byDay(entries) {
    const groups = [];
    for (const entry of entries) {
        const at = new Date(entry.updatedAt);
        const last = groups.at(-1);
        if (last && sameDay(last.date, at)) last.entries.push(entry);
        else groups.push({ date: at, entries: [entry] });
    }
    return groups;
}

// Share what I'm working on with my friends (the screen's one filled button)
function Composer() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            await dispatch(postToFeed(text.trim()));
            setText('');
        } catch {
            setError(t('feedPostFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={styles.composer} onSubmit={submit}>
            <label htmlFor="feedPost" className={styles.composerLabel}>{t('feedComposerLabel')}</label>
            <textarea id="feedPost" name="post" className={styles.composerField} value={text} rows={2} maxLength={FEED_POST_MAX}
                placeholder={t('feedComposerPlaceholder')} autoComplete="off"
                onChange={(e) => { setText(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }} />
            <div className={styles.composerFoot}>
                <span className={error ? styles.composerError : styles.composerHint} role={error ? 'alert' : undefined}>
                    {error ?? t('feedPostHint')}
                </span>
                <span className={styles.counter} aria-live="polite">{text.length}/{FEED_POST_MAX}</span>
                <button type="submit" className={styles.postBtn} disabled={busy || !text.trim()}>
                    {busy ? t('feedPosting') : t('feedPost')}
                </button>
            </div>
        </form>
    );
}

function LoadingRows() {
    return (
        <ul className={styles.list} aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
                <li key={i} className={styles.entry}>
                    <span className={styles.skeleton} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%' }} />
                    <div className={styles.body}>
                        <span className={styles.skeleton} style={{ width: `${70 - i * 8}%`, height: '0.9375rem' }} />
                        <span className={styles.skeleton} style={{ width: '35%', height: '0.8125rem', marginTop: '0.45rem' }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

// The feed tab: the composer, then what friends and I did, day by day
export default function Feed() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const { entries, next, loaded, failed } = useSelector(state => state.feed);
    const friendsLoaded = useSelector(state => state.friends.friendsLoaded);
    const friendCount = useSelector(state => state.friends.friends.length);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        dispatch(fetchFeed()).catch(() => {});
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const more = async () => {
        setLoadingMore(true);
        await dispatch(fetchMoreFeed()).catch(() => {});
        setLoadingMore(false);
    };
    const time = (value) => new Date(value).toLocaleTimeString(locale(language), { hour: '2-digit', minute: '2-digit' });

    return (
        <section className={styles.feed} aria-labelledby="feed-title">
            <h2 id="feed-title" className={styles.title}>{t('feedTitle')}</h2>
            <Composer />

            {!loaded && !failed && <LoadingRows />}
            {failed && !loaded && (
                <p className={styles.state}>
                    {t('feedFailed')}{' '}
                    <button type="button" className={styles.textBtn} onClick={() => dispatch(fetchFeed()).catch(() => {})}>{t('feedRetry')}</button>
                </p>
            )}
            {loaded && entries.length === 0 && (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{t('feedEmpty')}</p>
                    <p className={styles.emptyText}>{friendsLoaded && friendCount === 0 ? t('feedEmptyNoFriends') : t('feedEmptyHint')}</p>
                    {friendsLoaded && friendCount === 0 && <Link to={friendsPath('add')} className={styles.emptyAction}>{t('feedFindFriends')}</Link>}
                </div>
            )}

            {byDay(entries).map(group => (
                <div key={group.date.toDateString()} className={styles.day}>
                    <h3 className={styles.dayTitle}>{dayLabel(group.date, t, language)}</h3>
                    <ul className={styles.list}>
                        {group.entries.map(entry => <FeedEntry key={entry.id} entry={entry} timeText={time(entry.updatedAt)} />)}
                    </ul>
                </div>
            ))}

            {next && (
                <button type="button" className={styles.moreBtn} onClick={more} disabled={loadingMore}>{t('feedLoadMore')}</button>
            )}
        </section>
    );
}
