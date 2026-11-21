import { Fragment, useEffect, useRef, useState } from 'react';
import styles from '../Chat.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { localeOf } from '../../i18n/locale';
import { displayName, formatRelative } from '../../features/helperFunction';
import { useNow } from '../../features/together/work';
import ProfileAvatar from '../profile/ProfileAvatar';

// A chat card, newest at the bottom: the list follows new entries unless the reader scrolled up,
// bubbles for the messages, a send form. The source (the session's events, the family's messages)
// is a hook of its own and hands in:
//   items          [{ id, type: 'message', user, text, createdAt, mine }, ...]; any other type goes to renderItem(item, time)
//   onSend(text)   async; true once sent (the field is cleared)
//   canSend        false hides the form (an ended session)
//   hasMore / onLoadOlder   older entries on demand
//   title, emptyText, placeholder, maxLength, tall (fills the sidebar)
export default function ChatPanel({ items, onSend, canSend = true, hasMore = false, onLoadOlder, renderItem, title, emptyText, placeholder, maxLength, tall = false }) {
    const { t, language } = useTranslation();
    const locale = localeOf(language);
    const now = useNow(true, 30 * 1000);
    const time = (createdAt) => formatRelative(createdAt, now, locale);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const listRef = useRef(null);
    const stickToBottom = useRef(true);
    const lastId = items.at(-1)?.id;
    useEffect(() => {
        const list = listRef.current;
        if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    }, [lastId]);
    const onScroll = () => {
        const list = listRef.current;
        stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    };

    const submit = async (e) => {
        e.preventDefault();
        const message = text.trim();
        if (!message) return;
        setSending(true);
        stickToBottom.current = true;
        const sent = await onSend(message);
        setSending(false);
        if (sent) setText('');
    };

    return (
        <section className={`${styles.card} ${styles.feedCard} ${tall ? styles.feedTall : ''}`}>
            <h2 className={styles.cardTitle}>{title}</h2>
            <ol className={styles.feed} ref={listRef} onScroll={onScroll} aria-live="polite" aria-label={title}>
                {hasMore && <li className={styles.loadOlder}><button type="button" className={styles.older} onClick={onLoadOlder}>{t('loadOlder')}</button></li>}
                {items.length === 0 && <li className={styles.emptyLine}>{emptyText}</li>}
                {items.map(item => item.type === 'message' ? (
                    <li key={item.id} className={item.mine ? styles.messageMine : styles.message}>
                        {!item.mine && <ProfileAvatar plain user={item.user} size="small" />}
                        <div className={styles.bubble}>
                            {!item.mine && <span className={styles.bubbleName}>{displayName(item.user)}</span>}
                            <span className={styles.bubbleText}>{item.text}</span>
                            <time className={styles.feedTime} dateTime={item.createdAt}>{time(item.createdAt)}</time>
                        </div>
                    </li>
                ) : <Fragment key={item.id}>{renderItem(item, time)}</Fragment>)}
            </ol>
            {canSend && (
                <form className={styles.chatForm} onSubmit={submit}>
                    <input value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)}
                        placeholder={placeholder} aria-label={placeholder} />
                    <button type="submit" className={styles.send} disabled={sending || !text.trim()}>{t('send')}</button>
                </form>
            )}
        </section>
    );
}

// A non-message entry of a chat (what happened in the session)
export function ChatEvent({ type, text, createdAt, time }) {
    return (
        <li className={styles.feedEvent}>
            <span className={styles.feedDot} data-type={type} aria-hidden="true" />
            <span className={styles.feedText}>{text}</span>
            <time className={styles.feedTime} dateTime={createdAt}>{time(createdAt)}</time>
        </li>
    );
}
