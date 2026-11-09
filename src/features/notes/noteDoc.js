// A note's text (the stored line format, see noteLines in features/focus/notebook.js) ↔ the
// editor's document (TipTap / ProseMirror JSON). The notes keep being stored as lines, so boards,
// previews, the export, the server and older apps read them as before; the editor only shows
// them without their marks. Both ways are pure, round trips keep a note as it was.
//
// line            → node
// "# " / "## "    → heading 1 / 2
// "- [ ] " "- [x]"→ taskItem in a taskList
// "- " / "* "     → listItem in a bulletList
// "1. "           → listItem in an orderedList (start = the first number)
// "> "            → paragraph in a blockquote (lines in a row share one)
// "---"           → horizontalRule
// anything else   → paragraph (an empty line an empty one)
// list lines indented by two spaces per level nest under the line before.
// Inside a line: **bold**, `code` and links (plain URLs, a link mark in the editor).

import { noteLines, richParts } from '../focus/notebook';

const LIST_OF = { check: 'taskList', bullet: 'bulletList', numbered: 'orderedList' };

const indentOf = (line) => {
    const lead = line.match(/^\s*/)[0];
    return Math.floor([...lead].reduce((sum, char) => sum + (char === '\t' ? 2 : 1), 0) / 2);
};

const inline = (value) => richParts(value).map(part => {
    const marks = part.bold ? [{ type: 'bold' }] : part.code ? [{ type: 'code' }]
        : part.link ? [{ type: 'link', attrs: { href: part.text } }] : [];
    return { type: 'text', text: part.text, ...(marks.length ? { marks } : {}) };
});

const paragraph = (value) => {
    const content = inline(value);
    return { type: 'paragraph', ...(content.length ? { content } : {}) };
};

// list lines in a row → nested lists; levels never jump by more than one
function buildLists(items, start, level) {
    const lists = [];
    let i = start;
    while (i < items.length && items[i].level >= level) {
        const kind = items[i].kind;
        const list = { type: LIST_OF[kind], ...(kind === 'numbered' ? { attrs: { start: Number(items[i].number) } } : {}), content: [] };
        while (i < items.length && items[i].level === level && items[i].kind === kind) {
            const line = items[i];
            const node = { type: kind === 'check' ? 'taskItem' : 'listItem', ...(kind === 'check' ? { attrs: { checked: line.done } } : {}), content: [paragraph(line.text)] };
            i += 1;
            if (i < items.length && items[i].level > level) {
                const nested = buildLists(items, i, level + 1);
                node.content.push(...nested.lists);
                i = nested.next;
            }
            list.content.push(node);
        }
        lists.push(list);
    }
    return { lists, next: i };
}

export function bodyToDoc(body) {
    const raw = (body ?? '').split('\n');
    const lines = noteLines(body ?? '', true);
    const content = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (LIST_OF[line.kind]) {
            const items = [];
            let previous = -1;
            while (i < lines.length && LIST_OF[lines[i].kind]) {
                const level = Math.min(indentOf(raw[i]), previous + 1);
                items.push({ ...lines[i], level });
                previous = level;
                i += 1;
            }
            content.push(...buildLists(items, 0, 0).lists);
        } else if (line.kind === 'quote') {
            const quote = { type: 'blockquote', content: [] };
            while (i < lines.length && lines[i].kind === 'quote') quote.content.push(paragraph(lines[i++].text));
            content.push(quote);
        } else {
            i += 1;
            if (line.kind === 'heading' || line.kind === 'subheading') {
                const { content: inner } = paragraph(line.text);
                content.push({ type: 'heading', attrs: { level: line.kind === 'heading' ? 1 : 2 }, ...(inner ? { content: inner } : {}) });
            } else if (line.kind === 'divider') content.push({ type: 'horizontalRule' });
            else content.push(paragraph(line.text));
        }
    }
    return { type: 'doc', content: content.length ? content : [paragraph('')] };
}

// ---------- back to lines ----------
const hasMark = (node, type) => (node.marks ?? []).some(mark => mark.type === type);

const lineText = (node) => (node?.content ?? []).map(child => {
    if (child.type === 'hardBreak') return '\n';
    if (child.type !== 'text') return '';
    if (hasMark(child, 'code')) return `\`${child.text}\``;
    if (hasMark(child, 'bold')) return `**${child.text}**`;
    return child.text;
}).join('');

function listLines(list, depth, out) {
    const pad = '  '.repeat(depth);
    (list.content ?? []).forEach((entry, index) => {
        const marker = list.type === 'taskList' ? `- [${entry.attrs?.checked ? 'x' : ' '}] `
            : list.type === 'orderedList' ? `${(list.attrs?.start ?? 1) + index}. ` : '- ';
        const [first, ...rest] = entry.content ?? [];
        out.push(pad + marker + lineText(first));
        for (const child of rest) {
            if (child.type in LIST_TYPES) listLines(child, depth + 1, out);
            else out.push(`${pad}  ${lineText(child)}`);
        }
    });
}

const LIST_TYPES = { taskList: 1, bulletList: 1, orderedList: 1 };

export function docToBody(doc) {
    const out = [];
    for (const node of doc?.content ?? []) {
        if (node.type === 'heading') out.push(`${node.attrs?.level === 1 ? '#' : '##'} ${lineText(node)}`);
        else if (node.type === 'horizontalRule') out.push('---');
        else if (node.type === 'blockquote') (node.content ?? []).forEach(child => out.push(`> ${lineText(child)}`));
        else if (node.type in LIST_TYPES) listLines(node, 0, out);
        else out.push(lineText(node));
    }
    return out.join('\n');
}
