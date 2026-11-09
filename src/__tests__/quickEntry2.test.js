import { describe, it, expect } from 'vitest';
import { parseQuickEntry, needsAiHelp } from '../features/tasks/quickParse';

// Monday, 9 Nov 2026, 10:00
const NOW = new Date(2026, 10, 9, 10, 0);
const TYPES = [{ id: 3, name: 'Schule', keywords: [] }, { id: 4, name: 'School', keywords: [] }, { id: 5, name: 'Sport', keywords: ['training'] }];
const parse = (text) => parseQuickEntry(text, NOW, { eventTypes: TYPES });

describe('quick entry: a whole line', () => {
    it('reads the example line into an event', () => {
        expect(parse('Study 19.11. 13:00 - 15:00 blue type: school, reminder 15 mins prior.')).toMatchObject({
            kind: 'event', name: 'Study', due: '2026-11-19', time: '13:00', durationMinutes: 120,
            color: 'blue', eventTypeId: 4, reminders: [15],
        });
    });

    it('reads the same in German', () => {
        expect(parse('Lernen am 19.11. von 13 bis 15 Uhr blau Typ: Schule, Erinnerung 1 Tag vorher')).toMatchObject({
            kind: 'event', name: 'Lernen', due: '2026-11-19', time: '13:00', durationMinutes: 120,
            color: 'blue', eventTypeId: 3, reminders: [1440],
        });
    });

    it('time ranges in other spellings', () => {
        expect(parse('Training 1pm-3pm')).toMatchObject({ time: '13:00', durationMinutes: 120, kind: 'event' });
        expect(parse('Chor 18–19:30 Uhr')).toMatchObject({ time: '18:00', durationMinutes: 90 });
        expect(parse('Nachtschicht 22:00 - 2:00')).toMatchObject({ time: '22:00', durationMinutes: 240 });
    });

    it('a single time or a length keeps a task; a type alone makes an event', () => {
        expect(parse('Essay morgen 14 Uhr 90 min')).toMatchObject({ kind: 'task', due: '2026-11-10', time: '14:00', durationMinutes: 90 });
        expect(parse('Mathe lernen 2h')).toMatchObject({ kind: 'task', durationMinutes: 120 });
        expect(parse('Basketball Freitag Typ: Sport')).toMatchObject({ kind: 'event', eventTypeId: 5, due: '2026-11-13' });
    });

    it('several reminders, in minutes, hours and days', () => {
        expect(parse('Klausur 20.11. 8:00 - 10:00 Erinnerung 1 Tag vorher, Erinnerung 30 min vorher').reminders).toEqual([30, 1440]);
        expect(parse('Arzt Montag 9 Uhr remind me 2 hours before').reminders).toEqual([120]);
    });

    it('"Erinnere mich" / "remind me" at the start makes a reminder', () => {
        expect(parse('Erinnere mich morgen 18 Uhr Mama anrufen')).toMatchObject({ kind: 'reminder', name: 'Mama anrufen', due: '2026-11-10', time: '18:00' });
        expect(parse('remind me to call mom tomorrow at 6pm')).toMatchObject({ kind: 'reminder', name: 'call mom', time: '18:00' });
    });

    it('colours in both languages, only as whole words', () => {
        expect(parse('Referat rot').color).toBe('red');
        expect(parse('Referat Farbe: grün').color).toBe('green');
        expect(parse('Rotkäppchen lesen').color).toBeNull();
    });

    it('a type that isn\'t one of mine stays in the name', () => {
        expect(parse('Treffen Typ: Party')).toMatchObject({ eventTypeId: null, name: 'Treffen Typ: Party', kind: 'task' });
    });

    it('lists what it found, for the chips', () => {
        const kinds = parse('Study 19.11. 13:00 - 15:00 blue type: school, reminder 15 mins prior.').found.map(part => part.kind);
        expect(kinds.sort()).toEqual(['color', 'due', 'reminder', 'time', 'type'].sort());
    });

    it('older callers get what they had', () => {
        expect(parseQuickEntry('Essay morgen 14 Uhr !hoch', NOW)).toMatchObject({ name: 'Essay', due: '2026-11-10', time: '14:00', prio: 80 });
    });
});

describe('when the AI may help', () => {
    it('a long line with little found is offered to the AI', () => {
        const line = 'nächste woche irgendwann nachmittags mit lena für die chemie klausur lernen';
        expect(needsAiHelp(line, parse(line))).toBe(true);
    });

    it('a long line whose rest still has time words the rules missed is offered too', () => {
        const line = 'nächste woche dienstag nachmittags mit lena für die chemie klausur lernen so 90 minuten oder so';
        expect(needsAiHelp(line, parse(line))).toBe(true);
    });

    it('a long plain name is not', () => {
        const line = 'Präsentation über die Geschichte der Weimarer Republik vorbereiten morgen';
        expect(needsAiHelp(line, parse(line))).toBe(false);
    });

    it('a short line or one the rules understood is not', () => {
        expect(needsAiHelp('Essay', parse('Essay'))).toBe(false);
        const line = 'Study 19.11. 13:00 - 15:00 blue type: school, reminder 15 mins prior.';
        expect(needsAiHelp(line, parse(line))).toBe(false);
    });
});
