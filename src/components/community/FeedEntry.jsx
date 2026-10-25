import styles from './Feed.module.css';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, formatDuration } from '../../features/helperFunction';
import { cheerFeedEntry, removeFeedEntry } from '../../features/feed/feed';
import { challengeTitle, tierFor } from '../../features/progress/progress';
import { setCustomError } from '../../features/settings/settingsAction';
import ProfileAvatar from '../profile/ProfileAvatar';
import ConfirmDeleteButton from '../ConfirmDeleteButton';
import Icon from '../icons';

// A translated sentence with the person's name in it as a link ("{name} focused for 2 h");
// my own entries say "You ..." and have no name in them
function Sentence({ template, values, name }) {
    const text = fill(template, values);
    if (!text.includes('{name}')) return text;
    const [before, after] = text.split('{name}');
    return <>{before}{name}{after}</>;
}

// What the entry says: the sentence (with a "_me" form for my own) and the details under it
function describe(entry, t) {
    const mine = entry.mine ? '_me' : '';
    const data = entry.data ?? {};
    switch (entry.kind) {
        case 'day': {
            const tasks = data.tasksDone === 1 ? t('feed_tasksOne') : fill(t('feed_tasksMany'), { count: data.tasksDone });
            if (data.focusMs >= 60000) {
                return {
                    template: t(`feed_day${mine}`),
                    values: { time: formatDuration(data.focusMs) },
                    details: [
                        data.sessions > 0 && (data.sessions === 1 ? t('feed_daySession') : fill(t('feed_daySessions'), { count: data.sessions })),
                        data.tasksDone > 0 && tasks,
                    ],
                };
            }
            return { template: t(`feed_dayTasks${mine}`), values: { count: tasks }, details: [] };
        }
        case 'challenge':
            return {
                template: t(`${data.weekly ? 'feed_challengeWeek' : 'feed_challenge'}${mine}`),
                values: {},
                details: [challengeTitle(t, { id: data.challenge, goal: data.goal }), fill(t('challengeXp'), { xp: data.xp })],
            };
        case 'level':
            return { template: t(`feed_level${mine}`), values: { level: data.level }, details: [t(`tier_${tierFor(data.level).id}`)] };
        case 'streak':
            return { template: t(`feed_streak${mine}`), values: { days: data.days }, details: [] };
        default:
            return { template: t('feed_post'), values: {}, details: [] };
    }
}

// One entry of the feed: who, what, when; a friend's can be cheered on, mine taken out again
export default function FeedEntry({ entry, timeText }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const who = entry.mine ? t('feedYou') : displayName(entry.user);
    const profileLink = entry.mine ? '/profile' : `/u/${entry.user.username}`;
    const { template, values, details } = describe(entry, t);
    const meta = [...details.filter(Boolean), timeText];

    const toggleCheer = () => dispatch(cheerFeedEntry(entry, !entry.cheered))
        .catch(() => dispatch(setCustomError({ bool: true, message: t('profileError_generic') })));
    const remove = () => dispatch(removeFeedEntry(entry.id))
        .catch(() => dispatch(setCustomError({ bool: true, message: t('profileError_generic') })));

    const cheerers = entry.cheerers?.map(displayName) ?? [];
    const cheerSummary = entry.cheers === 0 ? null
        : entry.mine && cheerers.length > 0 ? fill(t('feedCheeredBy'), { names: cheerers.join(', ') + (entry.cheers > cheerers.length ? ` +${entry.cheers - cheerers.length}` : '') })
        : entry.cheers === 1 ? t('feedCheerOne') : fill(t('feedCheersCount'), { count: entry.cheers });

    return (
        <li className={styles.entry} data-kind={entry.kind}>
            <Link to={profileLink} className={styles.avatarLink} tabIndex={-1} aria-hidden="true">
                <ProfileAvatar user={entry.user} />
            </Link>
            <div className={styles.body}>
                <p className={styles.line} id={`feed-entry-${entry.id}`}>
                    <Sentence template={template} values={values}
                        name={<Link to={profileLink} className={styles.name}>{who}</Link>} />
                </p>
                {entry.kind === 'post' && <p className={styles.postText}>{entry.data?.text}</p>}
                <p className={styles.meta}>{meta.join(' · ')}</p>
                {entry.mine ? (
                    cheerSummary && (
                        <p className={styles.cheerSummary}><Icon name="flame" size={14} />{cheerSummary}</p>
                    )
                ) : (
                    <div className={styles.actions}>
                        <button type="button" className={`${styles.cheer} ${entry.cheered ? styles.cheered : ''}`}
                            aria-pressed={entry.cheered} onClick={toggleCheer} aria-describedby={`feed-entry-${entry.id}`}
                            aria-label={entry.cheered ? t('feedCheerUndo') : fill(t('feedCheerLabel'), { name: displayName(entry.user) })}>
                            <Icon name="flame" size={16} />
                            <span>{t(entry.cheered ? 'feedCheered' : 'feedCheer')}</span>
                            {entry.cheers > 0 && <span className={styles.cheerCount}>{entry.cheers}</span>}
                        </button>
                    </div>
                )}
            </div>
            {/* mine can be taken out again: at the row's end, shown on hover or focus with a mouse */}
            {entry.mine && (
                <ConfirmDeleteButton className={styles.remove} onConfirm={remove}
                    label={t('feedRemoveLabel')} confirmText={t('feedRemoveConfirm')} />
            )}
        </li>
    );
}
