import styles from '../Together.module.css';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, formatRelative } from '../../features/helperFunction';
import { describeEvent } from '../../features/together/format';
import { postSharedMessage } from '../../features/together/togetherAction';
import { useNow } from '../../features/together/work';
import { useTogetherRun } from '../../features/together/hooks';
import Avatar from './Avatar';

// What happened in the session and the chat, newest at the bottom
export default function ActivityFeed({ session, tall = false }) {
    const { t, language } = useTranslation();
    const run = useTogetherRun();
    const now = useNow(true, 30 * 1000);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';

    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    // follow new entries, unless the reader scrolled up to read older ones
    const listRef = useRef(null);
    const stickToBottom = useRef(true);
    const lastId = session.events.at(-1)?.id;
    useEffect(() => {
        const list = listRef.current;
        if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    }, [lastId]);
    const onScroll = () => {
        const list = listRef.current;
        stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const message = text.trim();
        if (!message) return;
        setSending(true);
        stickToBottom.current = true;
        if (await run(postSharedMessage(session.id, message))) setText('');
        setSending(false);
    };

    return (
        <section className={`${styles.card} ${styles.feedCard} ${tall ? styles.feedTall : ''}`}>
            <h2 className={styles.cardTitle}>{t('activity')}</h2>
            <ol className={styles.feed} ref={listRef} onScroll={onScroll} aria-live="polite" aria-label={t('activity')}>
                {session.events.length === 0 && <li className={styles.emptyLine}>{t('noActivity')}</li>}
                {session.events.map(event => event.type === 'message' ? (
                    <li key={event.id} className={event.user?.id === session.me ? styles.messageMine : styles.message}>
                        {event.user?.id !== session.me && <Avatar user={event.user} small />}
                        <div className={styles.bubble}>
                            {event.user?.id !== session.me && <span className={styles.bubbleName}>{displayName(event.user)}</span>}
                            <span className={styles.bubbleText}>{event.text}</span>
                            <time className={styles.feedTime} dateTime={event.createdAt}>{formatRelative(event.createdAt, now, locale)}</time>
                        </div>
                    </li>
                ) : (
                    <li key={event.id} className={styles.feedEvent}>
                        <span className={styles.feedDot} data-type={event.type} aria-hidden="true" />
                        <span className={styles.feedText}>{describeEvent(t, event)}</span>
                        <time className={styles.feedTime} dateTime={event.createdAt}>{formatRelative(event.createdAt, now, locale)}</time>
                    </li>
                ))}
            </ol>
            {!session.endedAt && (
                <form className={styles.chatForm} onSubmit={handleSend}>
                    <input
                        value={text}
                        maxLength={1000}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t('messagePlaceholder')}
                        aria-label={t('messagePlaceholder')}
                    />
                    <button type="submit" className={styles.primaryBtn} disabled={sending || !text.trim()}>{t('send')}</button>
                </form>
            )}
        </section>
    );
}
