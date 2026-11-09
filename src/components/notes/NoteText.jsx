// A note's text field: the editor (RichNoteEditor, its own chunk, loaded when a note opens).
// While it loads the text shows as it reads; if it can't be loaded (offline before it was ever
// fetched) a plain text field stands in, so a note can always be written. Same props as
// RichNoteEditor.

import { Component, Suspense, lazy, useId } from 'react';
import { NoteView } from './NoteView.jsx';
import { NOTE_BODY_MAX } from '../../features/focus/notebook';
import styles from '../focus/Notebook.module.css';

const RichNoteEditor = lazy(() => import('./RichNoteEditor.jsx'));

// the plain text field, with the same way of handing the text over
function PlainNoteText({ body, onChange, label, placeholder, autoFocus, tools, onPasteFiles, onPasteLink }) {
    const id = useId();
    const currentLine = () => {
        const el = document.getElementById(id);
        const value = el?.value ?? '';
        const at = el?.selectionStart ?? 0;
        const start = value.lastIndexOf('\n', at - 1) + 1;
        const end = value.indexOf('\n', at);
        return value.slice(start, end === -1 ? value.length : end).replace(/^\s*(- \[( |x|X)\] |#{1,2} |[-*] |\d{1,3}\. |> )/, '').trim();
    };
    // dictation into the plain field: at the cursor, handed over like typing
    const insertText = (text) => {
        const el = document.getElementById(id);
        if (!el) return;
        const at = el.selectionStart ?? el.value.length;
        el.setRangeText(text, at, el.selectionEnd ?? at, 'end');
        const value = el.value;
        onChange(() => value);
    };
    const onPaste = (e) => {
        const files = [...(e.clipboardData?.files ?? [])].filter(file => file.type.startsWith('image/'));
        if (files.length) { e.preventDefault(); onPasteFiles?.(files); return; }
        const text = (e.clipboardData?.getData('text') ?? '').trim();
        if (/^https?:\/\/[^\s]+$/i.test(text)) onPasteLink?.(text);
    };
    return (
        <>
            {tools && <div className={styles.toolbar}>{tools({ currentLine, insertText })}</div>}
            <textarea id={id} className={styles.area} defaultValue={body} maxLength={NOTE_BODY_MAX} aria-label={label}
                placeholder={placeholder} autoFocus={autoFocus} onPaste={onPaste} onChange={e => { const value = e.target.value; onChange(() => value); }} />
        </>
    );
}

class Fallback extends Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? <PlainNoteText {...this.props.fieldProps} /> : this.props.children;
    }
}

export default function NoteText(props) {
    return (
        <Fallback fieldProps={props}>
            <Suspense fallback={<div className={styles.readArea} aria-busy="true"><NoteView body={props.body} /></div>}>
                <RichNoteEditor {...props} />
            </Suspense>
        </Fallback>
    );
}
