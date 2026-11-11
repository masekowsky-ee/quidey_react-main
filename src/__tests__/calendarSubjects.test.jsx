import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { lessonsToEntries, lessonBoxes, colorLessons } from '../features/untis/untis'
import TaskChip from '../components/calendar/TaskChip'
import StudyPage from '../components/study/StudyPage'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const lesson = (id, subjectLong, over = {}) => ({ id, day: '2026-11-19', start: '08:00', end: '08:45', subject: subjectLong.slice(0, 1), subjectLong, room: '', className: '', status: 'normal', info: '', ...over })

describe('lessons take their subject\'s colour from Lernen', () => {
    const subjects = [
        { id: 1, name: 'Mathematik', color: 'blue', untisName: null },
        { id: 2, name: 'Deutsch', color: '#aa3366', untisName: null },
        { id: 3, name: 'Bio', color: 'green', untisName: 'Biologie' },
    ]

    it('by the subject\'s name (any case) or its Untis name; none matching stays without a colour', () => {
        const colored = colorLessons(lessonsToEntries([lesson(1, 'mathematik'), lesson(2, 'Deutsch'), lesson(3, 'Biologie'), lesson(4, 'Sport')]), subjects)
        expect(colored.map(e => e.color)).toEqual(['blue', '#aa3366', 'green', null])
    })

    it('without subjects nothing changes', () => {
        const entries = lessonsToEntries([lesson(1, 'Mathematik')])
        expect(colorLessons(entries, [])).toEqual(entries)
        expect(colorLessons(entries, undefined)).toEqual(entries)
    })

    it('the day box stays neutral while its lessons keep their colours', () => {
        const [box] = lessonBoxes(colorLessons(lessonsToEntries([lesson(1, 'Mathematik'), lesson(2, 'Deutsch')]), subjects), 'Stundenplan')
        expect(box.color).toBeNull()
        expect(box.lesson.items.map(i => i.color)).toEqual(['blue', '#aa3366'])
    })
})

describe('a planned study session in the calendar', () => {
    const study = { goalId: 1, goalName: 'Klausur', partName: 'Kapitel 1', subjectName: 'Mathe', subjectEmoji: null, subjectColor: 'blue', goalShape: 'star' }
    const task = (over) => ({ id: 5, name: 'Mathe lernen', due: '2026-11-19', due_time: '16:00', kind: 'task', color: 'blue', study, ...over })
    const chip = (t) => render(<Provider store={configureStore({ reducer: rootReducer })}><TaskChip task={t} today={new Date(2026, 10, 11)} onOpen={() => {}} /></Provider>)

    it('carries the goal\'s symbol instead of the dot', () => {
        const { container } = chip(task())
        expect(container.querySelector('svg[data-shape="star"]')).not.toBeNull()
        expect(container.querySelector('[data-study-mark]')).toBeNull()
    })

    it('another goal, another symbol; a goal without one gets the circle', () => {
        const { container } = chip(task({ study: { ...study, goalShape: 'heart' } }))
        expect(container.querySelector('svg[data-shape="heart"]')).not.toBeNull()
        cleanup()
        const plain = chip(task({ study: { ...study, goalShape: null } }))
        expect(plain.container.querySelector('svg[data-shape="circle"]')).not.toBeNull()
    })

    it('an ordinary task keeps its dot, no symbol', () => {
        const { container } = chip(task({ study: null }))
        expect(container.querySelector('svg[data-shape]')).toBeNull()
    })
})

describe('subjects made by Untis', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        sessionStorage.clear()
        const subjects = [
            { id: 1, name: 'Deutsch', emoji: null, color: 'red', archived: false, nextGoal: null, exam: { avg: null, n: 0 }, other: { avg: null, n: 0 }, fromUntis: true },
            { id: 2, name: 'Eigenes', emoji: null, color: 'blue', archived: false, nextGoal: null, exam: { avg: null, n: 0 }, other: { avg: null, n: 0 }, fromUntis: false },
        ]
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/tester/study/subjects') return subjects
            if (url.startsWith('/api/tester/study/goals?subject=')) return []
            return []
        })
    })
    afterEach(cleanup)

    function open(path) {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'u', displayName: 'U' } })
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true } })
        render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Routes><Route path="/study/:subjectId" element={<StudyPage />} /></Routes></MemoryRouter></Provider>)
    }

    it('can be folded away (the list\'s archive button) but not deleted', async () => {
        open('/study/1')
        await screen.findByRole('heading', { name: 'Deutsch' })
        expect(screen.queryByRole('button', { name: /Fach löschen/ })).toBeNull()
        expect(screen.getByText(/Mit Untis angelegt/)).toBeTruthy()
    })

    it('my own subject can still be deleted', async () => {
        open('/study/2')
        await screen.findByRole('heading', { name: 'Eigenes' })
        expect(screen.getByRole('button', { name: 'Fach löschen: Eigenes' })).toBeTruthy()
    })
})
