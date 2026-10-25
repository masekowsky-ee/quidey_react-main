import { useId, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './Tester.module.css';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { COMMENT_MAX, RATING_MAX, saveTesterFeedback } from '../../features/tester/feedback';

// Stars and a comment for one topic. A star saves at once (the same star again takes it away);
// the comment is saved with its button. onSaved(entry) gets what the server kept.
export default function FeedbackFields({ topic, name, entry, onSaved }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const commentId = useId();
    const statusId = useId();
    const rating = entry?.rating ?? null;
    const savedComment = entry?.comment ?? '';
    const [comment, setComment] = useState(savedComment);
    const [status, setStatus] = useState(null); // 'saving' | 'saved' | 'failed' | null

    // a newer saved comment (loaded after the field was shown, or just saved) replaces it
    const [shownSaved, setShownSaved] = useState(savedComment);
    if (shownSaved !== savedComment) {
        setShownSaved(savedComment);
        setComment(savedComment);
    }

    const save = async (changes) => {
        setStatus('saving');
        try {
            const saved = await dispatch(saveTesterFeedback(topic, changes));
            onSaved(saved);
            setStatus('saved');
        } catch {
            setStatus('failed');
        }
    };

    const changed = comment.trim() !== savedComment.trim();

    return (
        <div className={styles.feedback}>
            <div className={styles.stars} role="radiogroup" aria-label={fill(t('testerRatingLabel'), { name })}>
                {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map(value => (
                    <button key={value} type="button" role="radio" aria-checked={rating === value}
                        className={`${styles.star} ${rating !== null && value <= rating ? styles.starOn : ''}`}
                        aria-label={fill(t('testerStar'), { count: value })} title={fill(t('testerStar'), { count: value })}
                        onClick={() => save({ rating: rating === value ? null : value })}>
                        <Icon name="star" size={20} strokeWidth={1.6} />
                    </button>
                ))}
                {rating !== null &&
                    <button type="button" className={styles.clearStars} onClick={() => save({ rating: null })}>
                        {t('testerRatingClear')}
                    </button>}
            </div>
            <label className={styles.srOnly} htmlFor={commentId}>{fill(t('testerCommentLabel'), { name })}</label>
            <textarea id={commentId} className={styles.comment} rows={2} maxLength={COMMENT_MAX}
                value={comment} placeholder={t('testerCommentPlaceholder')} aria-describedby={statusId}
                onChange={(e) => { setComment(e.target.value); setStatus(null); }} />
            <div className={styles.feedbackFoot}>
                <span id={statusId} className={`${styles.status} ${status === 'failed' ? styles.statusError : ''}`} role="status">
                    {status === 'saving' && t('testerSaving')}
                    {status === 'saved' && t('testerSaved')}
                    {status === 'failed' && t('testerSaveFailed')}
                    {!status && comment.length > COMMENT_MAX * 0.8 && fill(t('testerCommentCount'), { count: comment.length, max: COMMENT_MAX })}
                </span>
                <button type="button" className={styles.saveBtn} disabled={!changed || status === 'saving'}
                    onClick={() => save({ comment: comment.trim() || null })}>
                    {t('testerSave')}
                </button>
            </div>
        </div>
    );
}
