import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRepeats, fromKey } from '../features/calendar/calendar';

// The server projects repeats too (utils/repeats.js there); both run the same fixtures
const path = resolve(import.meta.dirname, '../../../quidey_react-backend/scripts/test/fixtures/repeats.json');

describe('repeat projection matches the server', () => {
    test.skipIf(!existsSync(path))('every shared fixture', () => {
        const cases = JSON.parse(readFileSync(path, 'utf8'));
        expect(cases.length).toBeGreaterThanOrEqual(8);
        for (const { name, tasks, until, expected } of cases) {
            const got = projectRepeats(tasks, fromKey(until)).map(({ id, due }) => ({ id, due }));
            expect(got, name).toEqual(expected);
        }
    });
});
