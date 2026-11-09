// The four actions added with the Quidey statistics (note_written, routine_run, study_plan_applied,
// reminder_created) go only to Quidey's own counter: privacy § 3 lists what Firebase gets, and they
// are not on that list.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const spies = vi.hoisted(() => ({ trackEvent: vi.fn(), track: vi.fn() }))
vi.mock('../features/native/analytics', async (importOriginal) => ({ ...(await importOriginal()), trackEvent: spies.trackEvent }))
vi.mock('../features/usage/usage', async (importOriginal) => ({ ...(await importOriginal()), track: spies.track }))
vi.mock('../features/helperFunction', async (importOriginal) => ({ ...(await importOriginal()), apiFetch: vi.fn(async () => ({ id: 1 })) }))

import { createNote as createNotebookNote } from '../features/focus/notebook'
import { createNote as createTaskNote } from '../features/tasks/taskAction'
import { logRoutineRun } from '../features/routines/routines'
import { applyPlan } from '../features/study/study'
import { saveReminder } from '../features/reminders/reminders'
import { trackAction } from '../features/usage/track'

const dispatch = vi.fn(async (action) => (typeof action === 'function' ? action(dispatch, getState) : action))
const getState = () => ({ study: { goals: {} } })

beforeEach(() => {
    spies.trackEvent.mockClear()
    spies.track.mockClear()
})

const counted = () => spies.track.mock.calls.map(([name]) => name)

describe('actions only Quidey counts', () => {
    it('a notebook note and a task note: note_written, not to Firebase', async () => {
        await createNotebookNote({ title: 'x', body: '' })
        await createTaskNote(5, 'text')(dispatch, getState)
        expect(counted()).toEqual(['note_written', 'note_written'])
        expect(spies.trackEvent).not.toHaveBeenCalled()
    })

    it('a routine run: routine_run, not to Firebase', async () => {
        await logRoutineRun(3, { steps: [] })(dispatch, getState)
        expect(counted()).toEqual(['routine_run'])
        expect(spies.trackEvent).not.toHaveBeenCalled()
    })

    it('an applied study plan: study_plan_applied, not to Firebase', async () => {
        await applyPlan('hash')(dispatch, getState)
        expect(counted()).toContain('study_plan_applied')
        expect(spies.trackEvent).not.toHaveBeenCalled()
    })

    it('a new reminder: reminder_created, not to Firebase', async () => {
        await saveReminder({ text: 'x', at: '2026-11-08T10:00:00Z' })(dispatch, getState)
        expect(counted()).toEqual(['reminder_created'])
        expect(spies.trackEvent).not.toHaveBeenCalled()
    })

    it('the actions Firebase already had still go to both', () => {
        trackAction('focus_start', { mode: 'timer' })
        expect(spies.trackEvent).toHaveBeenCalledWith('focus_start', { mode: 'timer' })
        expect(counted()).toEqual(['focus_start'])
    })
})
