// The notes' editor: writing like in any notes app, without visible marks (TipTap / ProseMirror).
// The text still goes in and out as the stored lines (features/notes/noteDoc.js), so only what
// those lines can hold is offered: headings 1–2, checklists, lists (nested), numbered lists,
// quotes, dividers, bold, code and links (plain URLs). Typing "# ", "- ", "[ ] ", "1. ", "> "
// at the start of a line still turns it into that. Loaded on its own (lazy, NoteText.jsx).
// CSP: TipTap's own <style> tag stays off (injectCSS), its few rules are in the CSS module.
//
// onChange(getBody) after every change: getBody() turns the document into the stored text, so the
// caller only pays for it when saving. tools({ currentLine }) adds buttons at the end of the
// toolbar (with currentLine() and insertText(text)). onPasteFiles(files) takes pasted pictures (they never go into the text), onPasteLink(url)
// hears about a link pasted on its own (it still goes into the text).

import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Blockquote from '@tiptap/extension-blockquote';
import { ListItem, TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { bodyToDoc, docToBody } from '../../features/notes/noteDoc';
import { isWebUrl } from '../../features/focus/notebook';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './RichNoteEditor.module.css';

// what the stored lines can hold: list items hold their line and lists under it, quotes lines
const extensions = (placeholder, checkLabel) => [
    StarterKit.configure({
        heading: { levels: [1, 2] },
        italic: false,
        strike: false,
        underline: false,
        codeBlock: false,
        hardBreak: false,
        trailingNode: false,
        blockquote: false,
        listItem: false,
        link: { autolink: true, linkOnPaste: false, openOnClick: false },
    }),
    Blockquote.extend({ content: 'paragraph+' }),
    ListItem.extend({ content: 'paragraph list*' }),
    TaskList,
    TaskItem.extend({ content: 'paragraph list*' }).configure({ nested: true, a11y: { checkboxLabel: (node) => checkLabel(node.textContent) } }),
    Placeholder.configure({ placeholder }),
];

const MORE = [
    { key: 'noteToolSubheading', mark: 'H2', run: chain => chain.toggleHeading({ level: 2 }), active: ['heading', { level: 2 }] },
    { key: 'noteToolNumbered', mark: '1.', run: chain => chain.toggleOrderedList(), active: ['orderedList'] },
    { key: 'noteToolQuote', mark: '„', run: chain => chain.toggleBlockquote(), active: ['blockquote'] },
    { key: 'noteToolCode', mark: '</>', mono: true, run: chain => chain.toggleCode(), active: ['code'] },
    { key: 'noteToolDivider', mark: '—', run: chain => chain.setHorizontalRule() },
];

export default function RichNoteEditor({ body, onChange, label, placeholder = '', autoFocus = false, tools, onPasteFiles, onPasteLink }) {
    const { t } = useTranslation();
    const [moreOpen, setMoreOpen] = useState(false);
    const more = useRef(null);
    // the latest callbacks, for the editor made once
    const calls = useRef({ onChange, onPasteFiles, onPasteLink });
    useEffect(() => { calls.current = { onChange, onPasteFiles, onPasteLink }; });

    const editor = useEditor({
        extensions: extensions(placeholder, (text) => fill(t('noteCheckLabel'), { text: text || t('noteCheckEmpty') })),
        content: bodyToDoc(body),
        injectCSS: false,
        autofocus: autoFocus ? 'end' : false,
        editorProps: {
            attributes: { class: styles.prose, role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
            handlePaste: (view, event) => {
                const data = event.clipboardData;
                const files = [...(data?.files ?? [])].filter(file => file.type?.startsWith('image/'));
                if (files.length) { calls.current.onPasteFiles?.(files); return true; }
                const text = data?.getData('text/plain') || data?.getData('text') || '';
                if (isWebUrl(text)) calls.current.onPasteLink?.(text.trim());
                return false;
            },
        },
        onUpdate: ({ editor: changed }) => {
            const doc = changed.state.doc;
            calls.current.onChange?.(() => docToBody(doc.toJSON()));
        },
    });

    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            check: current.isActive('taskList'),
            heading: current.isActive('heading', { level: 1 }),
            bullet: current.isActive('bulletList'),
            bold: current.isActive('bold'),
            more: MORE.map(item => (item.active ? current.isActive(...item.active) : false)),
        }),
    });

    // the "more" list closes on a click beside it or Escape
    useEffect(() => {
        if (!moreOpen) return undefined;
        const away = (e) => { if (!more.current?.contains(e.target)) setMoreOpen(false); };
        const escape = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
        document.addEventListener('pointerdown', away);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
    }, [moreOpen]);

    const run = (step) => step(editor.chain().focus()).run();
    const currentLine = () => editor.state.selection.$from.parent.textContent.trim();
    // dictation: plain words at the cursor
    const insertText = (text) => editor.chain().focus().insertContent(text).run();

    const toolButton = (key, pressed, step, content) => (
        <button type="button" aria-pressed={pressed} onClick={() => run(step)} title={t(key)} aria-label={t(key)}>
            {content}
        </button>
    );

    return (
        <div className={styles.editor}>
            <div className={styles.toolbar} role="toolbar" aria-label={t('noteTools')}>
                {toolButton('noteToolCheck', active.check, chain => chain.toggleTaskList(), <><Icon name="checklist" size={16} /><span>{t('noteToolCheck')}</span></>)}
                {toolButton('noteToolHeading', active.heading, chain => chain.toggleHeading({ level: 1 }), <><span className={styles.mark}>H</span><span>{t('noteToolHeading')}</span></>)}
                {toolButton('noteToolBullet', active.bullet, chain => chain.toggleBulletList(), <Icon name="list" size={16} />)}
                {toolButton('noteToolBold', active.bold, chain => chain.toggleBold(), <strong className={styles.mark}>B</strong>)}
                <div className={styles.more} ref={more}>
                    <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)} title={t('noteToolMore')} aria-label={t('noteToolMore')}>
                        <Icon name="more" size={16} />
                    </button>
                    {moreOpen &&
                        <div className={styles.moreList} role="group" aria-label={t('noteToolMore')}>
                            {MORE.map((item, i) =>
                                <button key={item.key} type="button" aria-pressed={item.active ? active.more[i] : undefined}
                                    onClick={() => { run(item.run); setMoreOpen(false); }}>
                                    <span className={`${styles.mark} ${item.mono ? styles.mono : ''}`} aria-hidden="true">{item.mark}</span>
                                    <span>{t(item.key)}</span>
                                </button>)}
                        </div>}
                </div>
                {tools && <span className={styles.split} aria-hidden="true" />}
                {tools?.({ currentLine, insertText })}
            </div>
            <EditorContent editor={editor} className={styles.content} />
        </div>
    );
}
