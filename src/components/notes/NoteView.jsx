import { noteLines, richParts } from '../../features/focus/notebook';
import styles from '../focus/Notebook.module.css';
import own from './Notes.module.css';

// A line's text with its links, **bold** and `code` as React parts, never HTML
function LineText({ text }) {
    return richParts(text).map((part, i) => {
        if (part.link) return <a key={i} href={part.text} target="_blank" rel="noopener noreferrer">{part.text}</a>;
        if (part.bold) return <strong key={i}>{part.text}</strong>;
        if (part.code) return <code key={i} className={own.code}>{part.text}</code>;
        return <span key={i}>{part.text}</span>;
    });
}

// A note's text as it reads (somebody else's note on a board, the editor while it loads):
// headings, checklists, lists, numbered lines, quotes, dividers, links. With onToggle a checklist
// line can be ticked, without it the checklist is only read.
export function NoteView({ body, onToggle }) {
    const lines = noteLines(body, true);
    return (
        <div className={styles.view}>
            {lines.map(line => {
                const text = <LineText text={line.text} />;
                switch (line.kind) {
                    case 'check': return (
                        <label key={line.index} className={styles.checkLine} data-done={line.done || undefined}>
                            <input type="checkbox" checked={line.done} disabled={!onToggle} onChange={() => onToggle?.(line.index)} />
                            <span>{text}</span>
                        </label>);
                    case 'heading': return <h4 key={line.index} className={styles.heading}>{text}</h4>;
                    case 'subheading': return <h5 key={line.index} className={own.subheading}>{text}</h5>;
                    case 'bullet': return <p key={line.index} className={own.listLine}><span className={own.bullet} aria-hidden="true">•</span><span>{text}</span></p>;
                    case 'numbered': return <p key={line.index} className={own.listLine}><span className={own.number}>{line.number}.</span><span>{text}</span></p>;
                    case 'quote': return <blockquote key={line.index} className={own.quote}>{text}</blockquote>;
                    case 'divider': return <hr key={line.index} className={own.divider} />;
                    default: return <p key={line.index} className={styles.textLine}>{line.text ? text : ' '}</p>;
                }
            })}
        </div>
    );
}

export default NoteView;
