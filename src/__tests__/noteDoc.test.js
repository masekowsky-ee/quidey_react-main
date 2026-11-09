import { describe, it, expect } from 'vitest';
import { bodyToDoc, docToBody } from '../features/notes/noteDoc';

const p = (...content) => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
const text = (value, ...marks) => ({ type: 'text', text: value, ...(marks.length ? { marks: marks.map(type => typeof type === 'string' ? { type } : type) } : {}) });
const item = (type, para, children = [], attrs) => ({ type, ...(attrs ? { attrs } : {}), content: [para, ...children] });

const roundTrip = (body) => docToBody(bodyToDoc(body));

describe('bodyToDoc', () => {
    it('makes one empty paragraph of an empty note', () => {
        expect(bodyToDoc('')).toEqual({ type: 'doc', content: [p()] });
        expect(bodyToDoc(null)).toEqual({ type: 'doc', content: [p()] });
    });

    it('reads headings, quotes, dividers and plain lines', () => {
        expect(bodyToDoc('# Titel\n## Teil\n> Zitat\n---\nText').content).toEqual([
            { type: 'heading', attrs: { level: 1 }, content: [text('Titel')] },
            { type: 'heading', attrs: { level: 2 }, content: [text('Teil')] },
            { type: 'blockquote', content: [p(text('Zitat'))] },
            { type: 'horizontalRule' },
            p(text('Text')),
        ]);
    });

    it('puts consecutive quote lines into one quote', () => {
        expect(bodyToDoc('> a\n> b').content).toEqual([{ type: 'blockquote', content: [p(text('a')), p(text('b'))] }]);
    });

    it('reads checklists with their state', () => {
        expect(bodyToDoc('- [ ] offen\n- [x] fertig\n- [X] auch').content).toEqual([{
            type: 'taskList', content: [
                item('taskItem', p(text('offen')), [], { checked: false }),
                item('taskItem', p(text('fertig')), [], { checked: true }),
                item('taskItem', p(text('auch')), [], { checked: true }),
            ],
        }]);
    });

    it('reads bullets (- and *) and numbered lines with their first number', () => {
        expect(bodyToDoc('- a\n* b\n3. c\n4. d').content).toEqual([
            { type: 'bulletList', content: [item('listItem', p(text('a'))), item('listItem', p(text('b')))] },
            { type: 'orderedList', attrs: { start: 3 }, content: [item('listItem', p(text('c'))), item('listItem', p(text('d')))] },
        ]);
    });

    it('nests list lines indented by two spaces under the line before', () => {
        expect(bodyToDoc('- a\n  - [ ] b\n  - [x] c\n- d').content).toEqual([{
            type: 'bulletList', content: [
                item('listItem', p(text('a')), [{
                    type: 'taskList', content: [
                        item('taskItem', p(text('b')), [], { checked: false }),
                        item('taskItem', p(text('c')), [], { checked: true }),
                    ],
                }]),
                item('listItem', p(text('d'))),
            ],
        }]);
    });

    it('treats a first line that is indented, or a jump of several levels, as one level', () => {
        expect(docToBody(bodyToDoc('    - a\n        - b'))).toBe('- a\n  - b');
    });

    it('reads bold, code and links inside a line', () => {
        expect(bodyToDoc('**fett** und `code` auf https://quidey.com').content).toEqual([
            p(text('fett', 'bold'), text(' und '), text('code', 'code'), text(' auf '),
                text('https://quidey.com', { type: 'link', attrs: { href: 'https://quidey.com' } })),
        ]);
    });

    it('keeps empty lines as empty paragraphs and empty list lines as empty items', () => {
        expect(bodyToDoc('a\n\nb').content).toEqual([p(text('a')), p(), p(text('b'))]);
        expect(bodyToDoc('- [ ] ').content).toEqual([{ type: 'taskList', content: [item('taskItem', p(), [], { checked: false })] }]);
    });
});

describe('docToBody', () => {
    it('writes every kind of line the way the notes are stored', () => {
        const body = [
            '# Kapitel 4', '## Zusammenfassung', 'Ein **wichtiger** Satz mit `f(x)`.', '',
            '- [ ] lesen', '- [x] markieren', '- Punkt', '  - Unterpunkt', '    - [ ] tiefer',
            '1. erstens', '2. zweitens', '> Zitat', '> geht weiter', '---', 'https://quidey.com/notes',
        ].join('\n');
        expect(roundTrip(body)).toBe(body);
    });

    it('keeps an empty note empty and blank lines where they were', () => {
        expect(roundTrip('')).toBe('');
        expect(roundTrip('a\n\n\nb\n')).toBe('a\n\n\nb\n');
    });

    it('keeps text that only looks like a mark as it is', () => {
        for (const body of ['**', '** nur Anfang', 'a * b', '`', '### drei', '>kein Zitat', '- [ ]', '1.kein', 'x -- y']) {
            expect(roundTrip(body)).toBe(body);
        }
    });

    it('keeps leading spaces of plain lines', () => {
        expect(roundTrip('  eingerückt')).toBe('  eingerückt');
    });

    it('numbers a numbered list on from its first number', () => {
        expect(roundTrip('5. a\n5. b\n5. c')).toBe('5. a\n6. b\n7. c');
    });

    it('writes * bullets and [X] the one way', () => {
        expect(roundTrip('* a\n- [X] b')).toBe('- a\n- [x] b');
    });

    it('writes a second paragraph inside a list item as an indented line', () => {
        const doc = { type: 'doc', content: [{ type: 'bulletList', content: [item('listItem', p(text('a')), [p(text('weiter'))])] }] };
        expect(docToBody(doc)).toBe('- a\n  weiter');
    });

    it('writes bold that ends where a link starts as two bold parts', () => {
        const doc = { type: 'doc', content: [p(text('a', 'bold'), text('https://x.de', 'bold', { type: 'link', attrs: { href: 'https://x.de' } }))] };
        expect(docToBody(doc)).toBe('**a****https://x.de**');
    });

    it('writes a heading deeper than two as a subheading and a hard break as a new line', () => {
        const doc = { type: 'doc', content: [
            { type: 'heading', attrs: { level: 3 }, content: [text('h')] },
            p(text('eins'), { type: 'hardBreak' }, text('zwei')),
        ] };
        expect(docToBody(doc)).toBe('## h\neins\nzwei');
    });
});
