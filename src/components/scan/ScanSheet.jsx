// "Scannen": study material read by the AI (features/ai/scan.js, one scan a day for now) into a study
// plan (Lernen), notes and tasks/events. Three steps in one sheet: what to read and what to
// make → reading → what was found, each part kept or left out → made through the usual routes.
// onDone({ notes, entries, plan }) says how much was made.

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useSheet } from '../../features/layout/dragDismiss';
import { useAiQuota, left } from '../../features/ai/ai';
import { filesToSource, scanMaterial } from '../../features/ai/scan';
import { createNote, fetchNotes } from '../../features/focus/notebook';
import { addTask } from '../../features/tasks/taskAction';
import { fetchSubjects, saveSubject, createGoal, fetchStudySettings } from '../../features/study/study';
import { showToast } from '../../features/toast/toast';
import { fill, dueText } from '../../features/helperFunction';
import { durationText, timeText } from '../../features/calendar/calendar';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { NoteView } from '../notes/NoteView.jsx';
import frame from '../focus/FocusRoom.module.css';
import styles from './ScanSheet.module.css';

const SOURCES = ['file', 'note', 'text'];

export default function ScanSheet({ onClose, onDone }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const titleId = useId();
    const closeRef = useRef(null);
    const sheet = useSheet(onClose);
    const { dismiss } = sheet;
    const quota = useAiQuota();
    const scansLeft = left(quota?.scan);

    const [sourceKind, setSourceKind] = useState('file');
    const [files, setFiles] = useState([]);
    const [text, setText] = useState('');
    const [notes, setNotes] = useState(null);
    const [noteId, setNoteId] = useState('');
    const [wants, setWants] = useState(() => new Set(['plan', 'notes', 'entries']));
    const [step, setStep] = useState('pick');
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [keep, setKeep] = useState({ plan: true, notes: true, entries: new Set() });
    const [subjectId, setSubjectId] = useState('');
    const [planDue, setPlanDue] = useState('');
    const subjects = useSelector(state => state.study.subjects);

    useEffect(() => { closeRef.current?.focus(); }, []);
    useEffect(() => {
        if (sourceKind === 'note' && notes === null) fetchNotes().then(setNotes).catch(() => setNotes([]));
    }, [sourceKind, notes]);

    const toggleWant = (want) => setWants(prev => {
        const next = new Set(prev);
        if (next.has(want)) next.delete(want); else next.add(want);
        return next;
    });

    const ready = wants.size > 0 && scansLeft > 0 && (
        (sourceKind === 'file' && files.length > 0) || (sourceKind === 'text' && text.trim()) || (sourceKind === 'note' && noteId));

    async function scan() {
        setError(null);
        let source;
        try {
            source = sourceKind === 'file' ? await filesToSource(files)
                : sourceKind === 'note' ? { kind: 'note', noteId: Number(noteId) }
                    : { kind: 'text', text: text.trim() };
        } catch (err) {
            setError(t(`scanError_${err.code ?? 'SCAN_FILE_TYPE'}`));
            return;
        }
        setStep('reading');
        try {
            const found = await scanMaterial({ wants: ['plan', 'notes', 'entries'].filter(want => wants.has(want)), source });
            setResult(found);
            setKeep({ plan: Boolean(found.plan), notes: Boolean(found.notes), entries: new Set(found.entries.map((_, i) => i)) });
            setPlanDue(found.plan?.due ?? '');
            if (found.plan) {
                const list = await dispatch(fetchSubjects()).catch(() => []);
                const same = list.find(subject => subject.name.toLowerCase() === (found.plan.subject ?? '').toLowerCase());
                setSubjectId(same ? String(same.id) : (found.plan.subject ? 'new' : (list[0] ? String(list[0].id) : 'new')));
            }
            setStep('preview');
        } catch (err) {
            setStep('pick');
            setError(err.code === 'QUOTA_REACHED' ? t('scanNoneLeft')
                : err.code === 'SCAN_TOO_LONG' ? t('scanError_SCAN_TOO_LONG')
                    : t('scanFailed'));
        }
    }

    async function makeAll() {
        setStep('making');
        const made = { notes: 0, entries: 0, plan: 0 };
        try {
            if (result.notes && keep.notes) {
                await createNote({ title: result.notes.title, body: result.notes.body });
                made.notes = 1;
            }
            for (const [i, entry] of result.entries.entries()) {
                if (!keep.entries.has(i)) continue;
                await dispatch(addTask(entry.name, entry.due ?? '', '', null, null, undefined, {
                    kind: entry.kind,
                    due_time: entry.due && entry.time ? entry.time : null,
                    duration_minutes: entry.durationMinutes,
                }));
                made.entries += 1;
            }
            if (result.plan && keep.plan) {
                let id = Number(subjectId);
                if (subjectId === 'new' || !id) {
                    const subject = await dispatch(saveSubject(null, { name: result.plan.subject || result.plan.name }));
                    id = subject.id;
                }
                const settings = await dispatch(fetchStudySettings()).catch(() => null);
                await dispatch(createGoal({
                    subjectId: id, kind: result.plan.kind, name: result.plan.name, due: planDue,
                    planMode: settings?.windows?.length > 0 ? 'slots' : 'days',
                    parts: result.plan.parts.map(part => ({ name: part.name, estimateMinutes: part.minutes, estimateSource: 'ai' })),
                }));
                made.plan = 1;
            }
            dispatch(showToast(fill(t('scanMade'), { n: made.notes + made.entries + made.plan }), 'success'));
            onDone?.(made);
            dismiss();
        } catch (err) {
            setStep('preview');
            setError(err.message || t('scanFailed'));
        }
    }

    const back = quota?.resetsAt ? new Date(quota.resetsAt) : null;
    const planNeedsDay = result?.plan && keep.plan && !planDue;

    return createPortal(
        <div className={frame.settingsBackdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={frame.settingsSheet} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <div className={frame.settingsHead} data-sheet-drag>
                    <h2 id={titleId} className={frame.settingsTitle}>{t('scanTitle')}</h2>
                    <button type="button" ref={closeRef} className={frame.iconMini} onClick={() => dismiss()} aria-label={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>

                {(step === 'pick' || step === 'reading') &&
                    <div className={styles.body}>
                        <div className={styles.tabs} role="tablist" aria-label={t('scanWhat')}>
                            {SOURCES.map(kind =>
                                <button key={kind} type="button" role="tab" aria-selected={sourceKind === kind} onClick={() => setSourceKind(kind)}>
                                    {t(`scanSource_${kind}`)}
                                </button>)}
                        </div>
                        {sourceKind === 'file' &&
                            <label className={styles.drop}>
                                <Icon name="image" size={20} />
                                <span>{files.length ? files.map(file => file.name).join(', ') : t('scanFileHint')}</span>
                                <input type="file" accept="application/pdf,image/*" multiple className={styles.fileInput}
                                    aria-label={t('scanFileLabel')} onChange={e => setFiles([...e.target.files])} />
                            </label>}
                        {sourceKind === 'note' &&
                            <select className={styles.select} value={noteId} aria-label={t('scanNoteLabel')} onChange={e => setNoteId(e.target.value)}>
                                <option value="">{notes === null ? t('scanNotesLoading') : t('scanNotePick')}</option>
                                {(notes ?? []).map(note => <option key={note.id} value={note.id}>{note.title || t('noteUntitled')}</option>)}
                            </select>}
                        {sourceKind === 'text' &&
                            <textarea className={styles.text} rows={6} maxLength={60000} value={text} aria-label={t('scanTextLabel')}
                                placeholder={t('scanTextPlaceholder')} onChange={e => setText(e.target.value)} />}

                        <fieldset className={styles.wants}>
                            <legend>{t('scanMake')}</legend>
                            {['plan', 'notes', 'entries'].map(want =>
                                <label key={want} className={styles.want}>
                                    <input type="checkbox" checked={wants.has(want)} onChange={() => toggleWant(want)} />
                                    <span>{t(`scanWant_${want}`)}</span>
                                </label>)}
                        </fieldset>

                        <p className={styles.notice}>{t('scanNotice')}</p>
                        {error && <p className={styles.error} role="alert">{error}</p>}
                        {quota && scansLeft === 0 &&
                            <p className={styles.error}>{fill(t('scanNoneLeftAt'), { time: back ? timeText(back.getHours() * 60 + back.getMinutes()) : '0:00' })}</p>}
                        <button type="button" className={styles.primary} onClick={scan} disabled={!ready || step === 'reading'}>
                            <Icon name="brain" size={16} />
                            <span>{step === 'reading' ? t('scanReading') : t('scanStart')}</span>
                            {quota && <span className={styles.left}>{fill(t('aiLeft'), { n: scansLeft })}</span>}
                        </button>
                    </div>}

                {(step === 'preview' || step === 'making') && result &&
                    <section className={styles.body} aria-label={t('scanFound')}>
                        {!result.plan && !result.notes && result.entries.length === 0 && <p className={styles.notice}>{t('scanNothing')}</p>}
                        {result.plan &&
                            <div className={styles.part}>
                                <label className={styles.partHead}>
                                    <input type="checkbox" checked={keep.plan} onChange={() => setKeep(prev => ({ ...prev, plan: !prev.plan }))} />
                                    <span><Icon name="book" size={16} /> {fill(t('scanPlanTitle'), { name: result.plan.name })}</span>
                                </label>
                                {keep.plan && <>
                                    <div className={styles.planFields}>
                                        <label>
                                            <span>{t('scanSubject')}</span>
                                            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} aria-label={t('scanSubject')}>
                                                {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                                                <option value="new">{fill(t('scanSubjectNew'), { name: result.plan.subject || result.plan.name })}</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>{t('scanDue')}</span>
                                            <input type="date" value={planDue} onChange={e => setPlanDue(e.target.value)} aria-label={t('scanDue')} />
                                        </label>
                                    </div>
                                    <ol className={styles.parts}>
                                        {result.plan.parts.map(part => <li key={part.name}><span>{part.name}</span><span className={styles.muted}>{durationText(part.minutes)}</span></li>)}
                                    </ol>
                                </>}
                            </div>}
                        {result.notes &&
                            <div className={styles.part}>
                                <label className={styles.partHead}>
                                    <input type="checkbox" checked={keep.notes} onChange={() => setKeep(prev => ({ ...prev, notes: !prev.notes }))} />
                                    <span><Icon name="note" size={16} /> {result.notes.title}</span>
                                </label>
                                {keep.notes && <div className={styles.notePreview}><NoteView body={result.notes.body} /></div>}
                            </div>}
                        {result.entries.length > 0 &&
                            <div className={styles.part}>
                                <p className={styles.partTitle}><Icon name="calendar" size={16} /> {t('scanWant_entries')}</p>
                                <ul className={styles.entries}>
                                    {result.entries.map((entry, i) =>
                                        <li key={`${entry.name}-${i}`}>
                                            <label>
                                                <input type="checkbox" checked={keep.entries.has(i)} onChange={() => setKeep(prev => {
                                                    const next = new Set(prev.entries);
                                                    if (next.has(i)) next.delete(i); else next.add(i);
                                                    return { ...prev, entries: next };
                                                })} />
                                                <span>{entry.name}</span>
                                                <span className={styles.muted}>
                                                    {[t(entry.kind === 'event' ? 'quickAddEvent' : 'scanTask'), entry.due && dueText(entry.due, t), entry.time,
                                                        entry.durationMinutes && durationText(entry.durationMinutes)].filter(Boolean).join(' · ')}
                                                </span>
                                            </label>
                                        </li>)}
                                </ul>
                            </div>}
                        {error && <p className={styles.error} role="alert">{error}</p>}
                        {planNeedsDay && <p className={styles.error}>{t('scanPlanNeedsDay')}</p>}
                        <div className={styles.actions}>
                            <button type="button" className={styles.secondary} onClick={() => { setStep('pick'); setResult(null); }}>{t('scanBack')}</button>
                            <button type="button" className={styles.primary} onClick={makeAll} disabled={step === 'making' || planNeedsDay}>
                                {step === 'making' ? t('scanMaking') : t('scanKeep')}
                            </button>
                        </div>
                    </section>}
            </div>
        </div>,
        document.body
    );
}
