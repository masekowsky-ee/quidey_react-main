import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRepeats, fromKey } from '../features/calendar/calendar';

// The server projects repeats too (utils/repeats.js there); both run the same fixtures
const path = resolve(import.meta.dirname, '../../../quidey_react-backend/scripts/test/fixtures/repeats.json');

const cases = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];

describe('repeat projection matches the server', () => {
    test.skipIf(!existsSync(path))('there are enough shared fixtures', () => {
        expect(cases.length).toBeGreaterThanOrEqual(8);
    });

    test.skipIf(!existsSync(path)).each(cases)('$name', ({ tasks, until, expected }) => {
        const end = fromKey(until);
        if (!end) throw new Error(`fixture has an invalid until: ${until}`);
        expect(projectRepeats(tasks, end).map(({ id, due }) => ({ id, due }))).toEqual(expected);
    });
});
