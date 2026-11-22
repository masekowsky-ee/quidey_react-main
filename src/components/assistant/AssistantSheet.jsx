// The AI assistant's chat (Quidey Max), over whatever page is open: a darker backdrop, a sheet with
// the conversation, a text field, the microphone, "read answers aloud" and a close button.
// Requests: features/assistant/assistantApi.js; what is proposed: features/assistant/applyAction.js.
//
// - The chat stays until the app is closed (assistantApi.js keeps it in memory, per account).
// - New entries are made at once (one toast with "Rückgängig" for all of a reply); a move or a
//   delete is a card that says what changes, from my own copy of the entry, and waits for
//   "Bestätigen"; a study plan opens the new-goal sheet on Lernen, where it is previewed.
// - Study-area actions (subjects, goals, topics, settings, re-plan) work the same way, their cards are
//   components/assistant/StudyCard.jsx; the store's copy is read first (loadStudyContext).
// - A request can take minutes: "denkt nach" with a Stop. Stopping or closing drops the request:
//   an answer that comes later is not applied.
// - Reading aloud: `readAloud` (the toggle, kept in assistantApi.js; hidden where the device can't
//   speak) is read when the answer arrives (getReadAloud), so a switch during the wait counts.
//   Each answer is spoken (features/voice/speak.js); `onReply(message, { readAloud })` is called
//   once per answer that arrives while the sheet is open. Closing (or leaving the page) stops
//   any speech.

import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useSheet, useFocusOnArrival } from '../../features/layout/dragDismiss';
import { useModal } from '../../features/layout/useModal';
import {
    sendAssistant, useAssistantChat, updateChat, setReadAloud, getReadAloud, newMessageId,
    ASSISTANT_TIMEOUT_MS, MESSAGE_MAX,
} from '../../features/assistant/assistantApi';
import { applyAction, prepareActions, changeRows } from '../../features/assistant/applyAction';
import { loadStudyContext, isStudyAction } from '../../features/assistant/studyActions';
import { speak, speechOutputSupport, stopSpeaking } from '../../features/voice/speak';
import { speechLang } from '../../features/voice/voice';
import { useAiQuota, refreshAiQuota, left as leftOf } from '../../features/ai/ai';
import { selectHasMax, selectHasAssistant } from '../../features/pro/pro';
import { fetchAccess } from '../../features/auth/authAction';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { timeText } from '../../features/calendar/calendar';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import MicButton from '../voice/MicButton.jsx';
import StudyCard from './StudyCard.jsx';
import { useDay } from './useDay';
import Icon from '../icons.jsx';
import styles from './AssistantSheet.module.css';
import { quietly } from '../../features/api/quietly';
import { useStudyMessage } from '../study/studyUi';

export default function AssistantSheet({ onClose, onReply }) {
    const { t, language } = useTranslation();
    const studyMessage = useStudyMessage();
    const dispatch = useDispatch();
    const store = useStore();
    const navigate = useNavigate();
    const owner = useSelector(state => state.auth.username);
    const hasMax = useSelector(selectHasMax);
    const hasAssistant = useSelector(selectHasAssistant);
    const { messages, readAloud } = useAssistantChat(owner);
    const quota = useAiQuota();
    const titleId = useId();
    const fieldRef = useRef(null);
    const scrollRef = useRef(null);
    const request = useRef(null);
    const [text, setText] = useState('');
    const [pending, setPending] = useState(false);
    const [ended, setEnded] = useState(false);
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
        // the server may have counted it all the same
        refreshAiQuota();
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
    useModal(close, { nested: true });

    // gone (closed, pulled down, the page changed): nothing late is applied
    useEffect(() => {
        // what is left today, fresh: the app's copy is from before this chat's last answers
        refreshAiQuota();
        return () => {
            dropRef.current();
            stopSpeaking();
        };
    }, []);

    useEffect(() => {
        const box = scrollRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    }, [messages.length, pending]);

    const deps = { dispatch, getState: store.getState, navigate };

    async function makeEntries(messageId, cards) {
        const undos = [];
        const names = [];
        for (const card of cards) {
            try {
                const { undo } = await applyAction(card.action, deps);
                const name = card.action.entry?.name ?? card.study.title;
                // undone once, whether from the toast or the card (also both at the same time); a
                // failed undo says so (on the card and as a toast) and can be tried again
                let undone = false;
                let running = null;
                const once = () => {
                    if (undone) return Promise.resolve();
                    if (running) return running;
                    patchCard(messageId, card.key, { undoing: true, undoError: null });
                    running = (async () => {
                        try {
                            await undo?.();
                            undone = true;
                            patchCard(messageId, card.key, { status: 'undone', undo: null, undoing: false });
                        } catch (err) {
                            const message = fill(t(err?.code === 'subject_has_goals' ? 'assistantUndoSubjectHasGoals' : 'assistantUndoFailed'), { name });
                            patchCard(messageId, card.key, { undoing: false, undoError: message });
                            dispatch(showToast(message, 'error'));
                            throw err;
                        } finally {
                            running = null;
                        }
                    })();
                    return running;
                };
                undos.push(once);
                names.push(name);
                patchCard(messageId, card.key, { status: 'done', undo: once });
            } catch (err) {
                patchCard(messageId, card.key, { status: 'failed', error: studyMessage(err) });
            }
        }
        if (undos.length === 0) return;
        const text = undos.length === 1 ? fill(t('assistantCreated'), { name: names[0] }) : fill(t('assistantCreatedMany'), { n: undos.length });
        dispatch(showToast(text, 'success', {
            action: { label: t('toastUndo'), run: () => Promise.allSettled(undos.map(undo => undo())) },
        }));
    }

    // a new entry or study thing is made at once; the others wait for the confirm
    const madeAtOnce = (card) => card.type === 'create_entry' || card.type === 'study_create';

    // lookupFailed: reading the subjects / goals the reply names failed (not "not found")
    function answered({ message, actions, quota: answerQuota }, lookupFailed = false) {
        if (answerQuota?.assistant) setAnswerLeft(leftOf(answerQuota.assistant));
        const { cards, missing } = prepareActions(actions, store.getState().task.tasks, store.getState().study);
        const id = newMessageId();
        const shown = cards.map((card, i) => ({ ...card, key: `${id}-${i}`, status: madeAtOnce(card) ? 'busy' : 'pending' }));
        updateChat(owner, list => [...list, { id, role: 'assistant', content: message, cards: shown }]);
        if (missing > 0 && lookupFailed) addNote(t('assistantFailed'));
        else if (missing > 0) addNote(missing === 1 ? t('assistantMissing_one') : fill(t('assistantMissing'), { n: missing }));
        // the toggle as it is now: it may have been switched during the wait
        const aloud = getReadAloud();
        if (aloud && speechOutputSupport() && message.trim()) speak(message, { lang: speechLang(language) });
        onReply?.(message, { readAloud: aloud });
        const creates = shown.filter(madeAtOnce);
        if (creates.length > 0) makeEntries(id, creates);
    }

    function failed(err, timedOut) {
        if (err.code === 'MAX_REQUIRED') {
            setEnded(true);
            addNote(t('assistantMaxEnded'));
            // the button goes once the app knows
            quietly(dispatch(fetchAccess()));
            return;
        }
        if (err.code === 'QUOTA_REACHED') {
            const back = err.data?.resetsAt ? new Date(err.data.resetsAt) : null;
            setAnswerLeft(0);
            addNote(fill(t('assistantNoneLeft'), { max: err.data?.max ?? 20, time: back ? timeText(back.getHours() * 60 + back.getMinutes()) : '00:00' }));
            return;
        }
        // too long: the server's time or step / token limit for one message (AI_TOO_LONG): ask narrower
        addNote(t(timedOut || err.code === 'AI_TIMEOUT' || err.code === 'AI_TOO_LONG' ? 'assistantTimeout'
            : err.code === 'AI_UNAVAILABLE' ? 'assistantUnavailable'
                : err.code === 'AI_REFUSED' ? 'assistantRefused'
                    : 'assistantFailed'));
        // the message may have been counted all the same: what is left, read again
        setAnswerLeft(null);
        refreshAiQuota();
    }

    const disabled = ended || !hasAssistant;

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
            // the app's own copy of the subjects and goals the reply names, before the cards are made; the
            // request stays live meanwhile (Stop, closing and a new message still count)
            let lookupFailed = false;
            if ((Array.isArray(answer.actions) ? answer.actions : []).some(isStudyAction)) {
                await loadStudyContext(answer.actions, dispatch, store.getState).catch(() => { lookupFailed = true; });
                if (request.current !== running) return;
            }
            request.current = null;
            setPending(false);
            answered(answer, lookupFailed);
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
    const maxToday = quota?.assistant?.max ?? (hasMax ? 20 : 3);

    // in place (as FormSheet), not in a portal: the shell's --sidebar-w and --tabbar-h place it
    return (
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <header className={styles.head} data-sheet-drag="">
                    <Icon name="sparkle" size={20} className={styles.headIcon} />
                    <div className={styles.headText}>
                        <h2 id={titleId} className={styles.title}>{t('assistant')}</h2>
                        {leftToday !== null && <p className={styles.left}>{fill(t('assistantLeft'), { n: leftToday, max: maxToday })}</p>}
                    </div>
                    {speechOutputSupport() && (
                        <button type="button" className={styles.iconBtn} aria-pressed={readAloud} onClick={() => setReadAloud(!readAloud)}
                            aria-label={t('assistantReadAloud')} title={t('assistantReadAloud')}>
                            <Icon name={readAloud ? 'sound' : 'soundOff'} size={18} />
                        </button>
                    )}
                    <button type="button" className={styles.iconBtn} onClick={close} aria-label={t('close')} title={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </header>

                <div className={styles.scroll} ref={scrollRef}>
                    {messages.length === 0 && <p className={styles.intro}>{t('assistantIntro')}</p>}
                    <div role="log" aria-live="polite" aria-relevant="additions" className={styles.log}>
                        {messages.map(message => (
                            <Message key={message.id} message={message} deps={deps} onCardChange={(key, patch) => patchCard(message.id, key, patch)} onCreate={(card) => makeEntries(message.id, [card])} onLeave={close} />
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
        </div>
    );
}

function Message({ message, deps, onCardChange, onCreate, onLeave }) {
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
            {message.cards?.map(card => (isStudyAction(card.action)
                ? <StudyCard key={card.key} card={card} deps={deps} onChange={(patch) => onCardChange(card.key, patch)} onCreate={onCreate} onLeave={onLeave} />
                : <ActionCard key={card.key} card={card} deps={deps} onChange={(patch) => onCardChange(card.key, patch)} onLeave={onLeave} />))}
        </div>
    );
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
                {card.undoError && <p className={styles.cardStatus} data-status="failed" role="alert">{card.undoError}</p>}
                {status === 'done' && card.undo && (
                    <div className={styles.cardActions}>
                        <button type="button" className={styles.cancel} disabled={card.undoing}
                            onClick={() => card.undo().catch(() => { /* said on the card and in a toast */ })}>{t('assistantUndo')}</button>
                    </div>
                )}
            </div>
        );
    }

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
