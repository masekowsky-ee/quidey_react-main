// The AI assistant's chat (Quidey Max), over whatever page is open: a darker backdrop, a sheet with
// the conversation, a text field, the microphone, "read answers aloud" and a close button.
// Requests: features/assistant/assistantApi.js; what is proposed: features/assistant/applyAction.js.
//
// - The chat stays until the app is closed (assistantApi.js keeps it in memory, per account).
// - New entries are made at once (one toast with "Rückgängig" for all of a reply); a move or a
//   delete is a card that says what changes, from my own copy of the entry, and waits for
//   "Bestätigen"; a study plan opens the new-goal sheet on Lernen, where it is previewed.
// - A request can take minutes: "denkt nach" with a Stop. Stopping or closing drops the request:
//   an answer that comes later is not applied.
// - Task 7 hook: `readAloud` (the toggle, kept in assistantApi.js) and `onReply(message,
//   { readAloud })`, called once per answer that arrives while the sheet is open. Closing stops
//   any speech (speechSynthesis.cancel).

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useSheet, useFocusOnArrival } from '../../features/layout/dragDismiss';
import {
    sendAssistant, useAssistantChat, updateChat, setReadAloud, newMessageId,
    ASSISTANT_TIMEOUT_MS, MESSAGE_MAX,
} from '../../features/assistant/assistantApi';
import { applyAction, prepareActions, changeRows } from '../../features/assistant/applyAction';
import { useAiQuota, refreshAiQuota, left as leftOf } from '../../features/ai/ai';
import { selectHasMax } from '../../features/pro/pro';
import { fetchAccess } from '../../features/auth/authAction';
import { showToast } from '../../features/toast/toast';
import { fill, mondayIndex, parseDate } from '../../features/helperFunction';
import { timeText } from '../../features/calendar/calendar';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import MicButton from '../voice/MicButton.jsx';
import Icon from '../icons.jsx';
import styles from './AssistantSheet.module.css';

const stopSpeaking = () => {
    try { window.speechSynthesis?.cancel(); } catch { /* nothing speaking */ }
};

export default function AssistantSheet({ onClose, onReply }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const store = useStore();
    const navigate = useNavigate();
    const owner = useSelector(state => state.auth.username);
    const hasMax = useSelector(selectHasMax);
    const { messages, readAloud } = useAssistantChat(owner);
    const quota = useAiQuota();
    const titleId = useId();
    const fieldRef = useRef(null);
    const scrollRef = useRef(null);
    // the running request: { messageId, controller, timedOut }; null when none
    const request = useRef(null);
    const [text, setText] = useState('');
    const [pending, setPending] = useState(false);
    const [ended, setEnded] = useState(false);
    // what is left today, from the last answer (else from GET /api/ai/quota)
    const [answerLeft, setAnswerLeft] = useState(null);

    const sheet = useSheet(onClose);
    const { dismiss } = sheet;
    useFocusOnArrival(fieldRef);

    const patchMessage = (id, patch) => updateChat(owner, list => list.map(m => (m.id === id ? { ...m, ...patch } : m)));
    const patchCard = (messageId, key, patch) => updateChat(owner, list => list.map(m => (m.id === messageId
        ? { ...m, cards: m.cards.map(card => (card.key === key ? { ...card, ...patch } : card)) }
        : m)));
    const addNote = (content) => updateChat(owner, list => [...list, { id: newMessageId(), role: 'note', content }]);

    // Stop, or the sheet goes: the request is dropped (its answer is not applied) and its
    // message left out of what is sent next time
    const dropRequest = () => {
        const running = request.current;
        if (!running) return;
        request.current = null;
        running.controller.abort();
        setPending(false);
        patchMessage(running.messageId, { unanswered: true });
        addNote(t('assistantStopped'));
    };
    const dropRef = useRef(dropRequest);
    useEffect(() => { dropRef.current = dropRequest; });

    const close = () => {
        dropRequest();
        stopSpeaking();
        dismiss();
    };
    const closeRef = useRef(close);
    useEffect(() => { closeRef.current = close; });

    // Escape closes; gone (closed, pulled down, the page changed): nothing late is applied, the
    // focus goes back where it was
    useEffect(() => {
        const previous = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            dropRef.current();
            stopSpeaking();
            previous?.focus?.();
        };
    }, []);

    useEffect(() => {
        const box = scrollRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    }, [messages.length, pending]);

    const deps = { dispatch, getState: store.getState, navigate };

    // the new entries of one answer: made at once, one toast to undo them all
    async function makeEntries(messageId, cards) {
        const undos = [];
        const names = [];
        for (const card of cards) {
            try {
                const { undo } = await applyAction(card.action, deps);
                let used = false;
                const once = async () => {
                    if (used) return;
                    used = true;
                    await undo?.();
                    patchCard(messageId, card.key, { status: 'undone', undo: null });
                };
                undos.push(once);
                names.push(card.action.entry.name);
                patchCard(messageId, card.key, { status: 'done', undo: once });
            } catch (err) {
                patchCard(messageId, card.key, { status: 'failed', error: err.message });
            }
        }
        if (undos.length === 0) return;
        const text = undos.length === 1 ? fill(t('assistantCreated'), { name: names[0] }) : fill(t('assistantCreatedMany'), { n: undos.length });
        dispatch(showToast(text, 'success', {
            action: { label: t('toastUndo'), run: () => Promise.all(undos.map(undo => undo().catch(() => {}))) },
        }));
    }

    function answered({ message, actions, quota: answerQuota }) {
        if (answerQuota?.assistant) setAnswerLeft(leftOf(answerQuota.assistant));
        const { cards, missing } = prepareActions(actions, store.getState().task.tasks);
        const id = newMessageId();
        const shown = cards.map((card, i) => ({ ...card, key: `${id}-${i}`, status: card.type === 'create_entry' ? 'busy' : 'pending' }));
        updateChat(owner, list => [...list, { id, role: 'assistant', content: message, cards: shown }]);
        if (missing > 0) addNote(missing === 1 ? t('assistantMissing_one') : fill(t('assistantMissing'), { n: missing }));
        onReply?.(message, { readAloud });
        const creates = shown.filter(card => card.type === 'create_entry');
        if (creates.length > 0) makeEntries(id, creates);
    }

    function failed(err, timedOut) {
        if (err.code === 'MAX_REQUIRED') {
            setEnded(true);
            addNote(t('assistantMaxEnded'));
            // the button goes once the app knows
            dispatch(fetchAccess()).catch(() => {});
            return;
        }
        if (err.code === 'QUOTA_REACHED') {
            const back = err.data?.resetsAt ? new Date(err.data.resetsAt) : null;
            setAnswerLeft(0);
            addNote(fill(t('assistantNoneLeft'), { max: err.data?.max ?? 20, time: back ? timeText(back.getHours() * 60 + back.getMinutes()) : '00:00' }));
            return;
        }
        addNote(t(timedOut || err.code === 'AI_TIMEOUT' ? 'assistantTimeout'
            : err.code === 'AI_UNAVAILABLE' ? 'assistantUnavailable'
                : err.code === 'AI_REFUSED' ? 'assistantRefused'
                    : 'assistantFailed'));
        // the message may have been counted all the same: what is left, read again
        setAnswerLeft(null);
        refreshAiQuota();
    }

    const disabled = ended || !hasMax;

    async function send() {
        const content = text.trim().slice(0, MESSAGE_MAX);
        if (!content || pending || disabled) return;
        const mine = { id: newMessageId(), role: 'user', content };
        const history = [...messages, mine];
        updateChat(owner, list => [...list, mine]);
        setText('');
        const running = { messageId: mine.id, controller: new AbortController(), timedOut: false };
        request.current = running;
        setPending(true);
        const timer = setTimeout(() => { running.timedOut = true; running.controller.abort(); }, ASSISTANT_TIMEOUT_MS);
        try {
            const answer = await sendAssistant(history, language, { signal: running.controller.signal });
            if (request.current !== running) return;
            request.current = null;
            setPending(false);
            answered(answer);
        } catch (err) {
            if (request.current !== running) return;
            request.current = null;
            setPending(false);
            patchMessage(mine.id, { unanswered: true });
            failed(err, running.timedOut);
        } finally {
            clearTimeout(timer);
        }
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
            e.preventDefault();
            send();
        }
    };

    const leftToday = answerLeft ?? (quota?.assistant ? leftOf(quota.assistant) : null);
    const maxToday = quota?.assistant?.max ?? 20;

    return createPortal(
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <header className={styles.head} data-sheet-drag="">
                    <Icon name="sparkle" size={20} className={styles.headIcon} />
                    <div className={styles.headText}>
                        <h2 id={titleId} className={styles.title}>{t('assistant')}</h2>
                        {leftToday !== null && <p className={styles.left}>{fill(t('assistantLeft'), { n: leftToday, max: maxToday })}</p>}
                    </div>
                    <button type="button" className={styles.iconBtn} aria-pressed={readAloud} onClick={() => setReadAloud(!readAloud)}
                        aria-label={t('assistantReadAloud')} title={t('assistantReadAloud')}>
                        <Icon name={readAloud ? 'sound' : 'soundOff'} size={18} />
                    </button>
                    <button type="button" className={styles.iconBtn} onClick={close} aria-label={t('close')} title={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </header>

                <div className={styles.scroll} ref={scrollRef}>
                    {messages.length === 0 && <p className={styles.intro}>{t('assistantIntro')}</p>}
                    <div role="log" aria-live="polite" aria-relevant="additions" className={styles.log}>
                        {messages.map(message => (
                            <Message key={message.id} message={message} deps={deps} onCardChange={(key, patch) => patchCard(message.id, key, patch)} onLeave={close} />
                        ))}
                    </div>
                    {pending && (
                        <div className={styles.thinking} role="status">
                            <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
                            <span>{t('assistantThinking')}</span>
                            <button type="button" className={styles.stop} onClick={dropRequest}>{t('assistantStop')}</button>
                        </div>
                    )}
                </div>

                <form className={styles.compose} onSubmit={(e) => { e.preventDefault(); send(); }}>
                    <textarea ref={fieldRef} className={styles.field} rows={1} value={text} maxLength={MESSAGE_MAX}
                        onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} disabled={disabled}
                        aria-label={t('assistantField')} placeholder={t('assistantPlaceholder')} enterKeyHint="send" />
                    {!disabled && <MicButton className={styles.mic} size={18} onText={(spoken) => setText(spoken.slice(0, MESSAGE_MAX))} />}
                    <button type="submit" className={styles.send} disabled={disabled || pending || !text.trim()}
                        aria-label={t('assistantSend')} title={t('assistantSend')}>
                        <Icon name="arrowUp" size={18} strokeWidth={2} />
                    </button>
                </form>
            </section>
        </div>,
        document.body,
    );
}

function Message({ message, deps, onCardChange, onLeave }) {
    const { t } = useTranslation();
    if (message.role === 'note') return <p className={styles.note}>{message.content}</p>;
    if (message.role === 'user') {
        return (
            <div className={styles.user} data-unanswered={message.unanswered || undefined}>
                <span className={styles.srOnly}>{t('assistantYou')}: </span>{message.content}
            </div>
        );
    }
    return (
        <div className={styles.reply}>
            {message.content && <p className={styles.replyText}>{message.content}</p>}
            {message.cards?.map(card => <ActionCard key={card.key} card={card} deps={deps} onChange={(patch) => onCardChange(card.key, patch)} onLeave={onLeave} />)}
        </div>
    );
}

// "Fr 21.11." from "2026-11-21"
function useDay() {
    const { t } = useTranslation();
    return (value) => {
        const day = parseDate(value);
        return day ? `${t('weekDays', mondayIndex(day))} ${day.getDate()}.${day.getMonth() + 1}.` : t('assistantNoDay');
    };
}

function ActionCard({ card, deps, onChange, onLeave }) {
    const { t } = useTranslation();
    const dayText = useDay();
    const id = useId();
    const { type, action, status } = card;

    const shown = (field, value) => {
        if (field === 'day') return dayText(value);
        if (field === 'time') return value ?? t('assistantNoTime');
        if (field === 'end') return value ?? '–';
        return value ?? '';
    };

    async function confirm() {
        onChange({ status: 'busy', error: null });
        try {
            const result = await applyAction(action, deps);
            onChange({ status: result.cancelled ? 'pending' : 'done' });
        } catch (err) {
            onChange({ status: 'failed', error: err.code === 'NOT_FOUND' ? t('assistantGone') : err.message });
        }
    }

    async function openPlan() {
        onChange({ status: 'busy', error: null });
        try {
            await applyAction(action, deps);
            onChange({ status: 'pending' });
            onLeave();
        } catch (err) {
            onChange({ status: 'failed', error: err.message });
        }
    }

    const statusLine = status === 'done' ? t(`assistantDone_${type === 'create_entry' ? 'create' : type === 'delete_entry' ? 'delete' : 'update'}`)
        : status === 'cancelled' ? t('assistantCancelled')
            : status === 'undone' ? t('assistantUndone')
                : status === 'failed' ? fill(t('assistantActionFailed'), { error: card.error || t('assistantFailed') })
                    : null;

    if (type === 'study_plan') {
        const topics = action.topics ?? [];
        return (
            <div role="group" aria-labelledby={id} className={styles.card} data-status={status}>
                <p id={id} className={styles.cardTitle}>{fill(t('assistantPlan'), { subject: action.subject })}</p>
                <p className={styles.cardMeta}>
                    {fill(t('assistantPlanExam'), { date: dayText(action.examDate) })}
                    {topics.length > 0 && <>, {topics.length === 1 ? t('assistantPlanTopics_one') : fill(t('assistantPlanTopics'), { n: topics.length })}</>}
                </p>
                {topics.length > 0 && <ul className={styles.topics}>{topics.map((topic, i) => <li key={i}>{topic}</li>)}</ul>}
                {status === 'failed' && <p className={styles.cardStatus}>{statusLine}</p>}
                <div className={styles.cardActions}>
                    <button type="button" className={styles.confirm} onClick={openPlan} disabled={status === 'busy'}>{t('assistantPlanOpen')}</button>
                </div>
            </div>
        );
    }

    if (type === 'create_entry') {
        const { entry } = action;
        const when = [entry.due && dayText(entry.due), entry.due && entry.time].filter(Boolean).join(', ');
        return (
            <div role="group" aria-labelledby={id} className={styles.card} data-status={status}>
                <p className={styles.cardKind}>{t('assistantNewEntry')}</p>
                <p id={id} className={styles.cardTitle}>{entry.name}</p>
                {when && <p className={styles.cardMeta}>{when}</p>}
                {statusLine && <p className={styles.cardStatus} data-status={status}>{statusLine}</p>}
                {status === 'done' && card.undo && (
                    <div className={styles.cardActions}>
                        <button type="button" className={styles.cancel} onClick={() => card.undo()}>{t('assistantUndo')}</button>
                    </div>
                )}
            </div>
        );
    }

    // a move or a delete: my own copy of the entry and what changes, then Bestätigen / Abbrechen
    const kindId = `${id}-kind`;
    const rows = type === 'update_entry' ? changeRows(card.task, action.changes) : [];
    const task = card.task;
    return (
        <div role="group" aria-labelledby={`${kindId} ${id}`} className={styles.card} data-status={status} data-kind={type}>
            <p id={kindId} className={styles.cardKind}>{t(type === 'delete_entry' ? 'assistantDelete' : 'assistantMove')}</p>
            <p id={id} className={styles.cardTitle}>{task.name}</p>
            {type === 'delete_entry' && (
                <p className={styles.cardMeta}>{[dayText(task.due), task.due_time?.slice(0, 5)].filter(Boolean).join(', ')}</p>
            )}
            {rows.length > 0 && (
                <dl className={styles.changes}>
                    {rows.map(row => (
                        <div key={row.field} className={styles.change}>
                            <dt>{t(`assistantField_${row.field}`)}</dt>
                            <dd>
                                <span className={styles.from}>{shown(row.field, row.from)}</span>
                                <Icon name="arrowRight" size={14} className={styles.arrow} />
                                <span className={styles.srOnly}> {t('assistantTo')} </span>
                                <span className={styles.to}>{shown(row.field, row.to)}</span>
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {statusLine && <p className={styles.cardStatus} data-status={status}>{statusLine}</p>}
            {(status === 'pending' || status === 'busy') && (
                <div className={styles.cardActions}>
                    <button type="button" className={styles.confirm} onClick={confirm} disabled={status === 'busy'}>{t('assistantConfirm')}</button>
                    <button type="button" className={styles.cancel} onClick={() => onChange({ status: 'cancelled' })} disabled={status === 'busy'}>{t('assistantCancel')}</button>
                </div>
            )}
        </div>
    );
}
