import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { noteLines, richParts } from '../features/focus/notebook'
import {
    parseView, notesInView, sortNotes, tagCounts, cleanTag, continueList, wrapSelection, wordCount,
    noteMarkdown, noteFileName, templateNote, duplicateOf, daysLeftInTrash,
} from '../features/notes/notes'
import collectionsReducer, { collectionContents, collectionsOf } from '../features/collections/collections'
import { TEST_FEATURES } from '../features/tester/feedback'
import translations from '../i18n/translations'
import FocusTimer from '../components/focus/FocusTimer'
import NotesPage from '../components/notes/NotesPage'
import Collections from '../components/collections/Collections'
import TaskEditor from '../components/calendar/TaskEditor'
import GroupBtnContainer from '../components/GroupBtnContainer'
import GroupForm from '../components/GroupForm'
import TaskContainer from '../components/TaskContainer'
import { filterTasks } from '../features/calendar/calendar'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const t = (key) => translations.en[key] ?? key

const note = (overrides) => ({
    id: 1, title: '', body: '', taskId: null, pinned: false, attachments: [], folderId: null, tags: [], color: null,
    archived: false, trashedAt: null, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', ...overrides,
})

function makeStore({ isTester = true, tasks = [] } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [] } })
    return store
}

function wrap(ui, store, path = '/') {
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </Provider>
    )
}

// answers by address; anything else resolves to {}
function serve(routes) {
    apiFetch.mockImplementation(async (url, options = {}) => {
        const key = `${options.method ?? 'GET'} ${url}`
        if (key in routes) return typeof routes[key] === 'function' ? routes[key](options) : routes[key]
        return {}
    })
}

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('notes: views, search, order', () => {
    const notes = [
        note({ id: 1, title: 'Analysis', body: 'Ableitungen', tags: ['klausur'], folderId: 3, updatedAt: '2026-11-02T10:00:00Z' }),
        note({ id: 2, title: 'Bio', body: 'Zellen', pinned: true, tags: ['Klausur', 'bio'] }),
        note({ id: 3, title: 'Alt', body: 'weg', archived: true, tags: ['klausur'] }),
    ]

    it('reads the view from the address', () => {
        expect(parseView('folder:3')).toEqual({ kind: 'folder', folderId: 3 })
        expect(parseView('tag:klausur')).toEqual({ kind: 'tag', tag: 'klausur' })
        expect(parseView('archive')).toEqual({ kind: 'archive' })
        expect(parseView('folder:x')).toEqual({ kind: 'all' })
        expect(parseView(null)).toEqual({ kind: 'all' })
    })

    it('keeps archived notes in the archive only; folders and tags filter (any case)', () => {
        expect(notesInView(notes, 'all').map(n => n.id)).toEqual([1, 2])
        expect(notesInView(notes, 'archive').map(n => n.id)).toEqual([3])
        expect(notesInView(notes, 'folder:3').map(n => n.id)).toEqual([1])
        expect(notesInView(notes, 'tag:KLAUSUR').map(n => n.id)).toEqual([1, 2])
        expect(notesInView(notes, 'pinned').map(n => n.id)).toEqual([2])
    })

    it('searches words in title, text and tags, "#word" only in tags', () => {
        expect(notesInView(notes, 'all', 'zellen').map(n => n.id)).toEqual([2])
        expect(notesInView(notes, 'all', '#bio').map(n => n.id)).toEqual([2])
        expect(notesInView(notes, 'all', 'analysis ableit').map(n => n.id)).toEqual([1])
        expect(notesInView(notes, 'all', '#zellen')).toEqual([])
    })

    it('sorts pinned first, then as chosen', () => {
        expect(sortNotes(notes.slice(0, 2), 'updated').map(n => n.id)).toEqual([2, 1])
        expect(sortNotes([notes[0], note({ id: 9, title: 'Algebra' })], 'title').map(n => n.id)).toEqual([9, 1])
    })

    it('counts tags outside the archive, the same word in any case once', () => {
        expect(tagCounts(notes)).toEqual([{ tag: 'klausur', count: 2 }, { tag: 'bio', count: 1 }])
        expect(cleanTag(' #Mathe, ')).toBe('Mathe')
        expect(cleanTag('#')).toBeNull()
    })
})

describe('notes: writing', () => {
    it('goes on with a list on Enter and ends it on an empty item', () => {
        expect(continueList('- Milch', 7)).toEqual({ body: '- Milch\n- ', cursor: 10 })
        expect(continueList('1. Eins', 7)).toEqual({ body: '1. Eins\n2. ', cursor: 11 })
        expect(continueList('- [x] Fertig', 12)).toEqual({ body: '- [x] Fertig\n- [ ] ', cursor: 19 })
        expect(continueList('a\n- ', 4)).toEqual({ body: 'a\n', cursor: 2 })
        expect(continueList('Nur Text', 8)).toBeNull()
    })

    it('puts **bold** around the selection and takes it off again', () => {
        expect(wrapSelection('ein Wort', 4, 8, '**')).toEqual({ body: 'ein **Wort**', start: 6, end: 10 })
        expect(wrapSelection('ein **Wort**', 4, 12, '**')).toEqual({ body: 'ein Wort', start: 4, end: 8 })
    })

    it('reads the richer lines and marks only when asked', () => {
        const body = '## Teil\n- Punkt\n2. Zwei\n> Zitat\n---\n- [ ] offen'
        expect(noteLines(body, true).map(line => line.kind)).toEqual(['subheading', 'bullet', 'numbered', 'quote', 'divider', 'check'])
        expect(noteLines(body).map(line => line.kind)).toEqual(['text', 'text', 'text', 'text', 'text', 'check'])
        expect(richParts('so **fett** und `x` https://a.de')).toEqual([
            { link: false, text: 'so ' }, { text: 'fett', bold: true }, { link: false, text: ' und ' }, { text: 'x', code: true },
            { link: false, text: ' ' }, { link: true, text: 'https://a.de' },
        ])
    })

    it('counts words, makes templates, copies and exports', () => {
        expect(wordCount('- [ ] Zwei Wörter')).toBe(2)
        const tpl = templateNote('lecture', 'de', new Date(2026, 10, 3))
        expect(tpl.title).toBe('Vorlesung vom 3. November 2026')
        expect(tpl.body).toContain('## Offene Fragen')
        const copy = duplicateOf(note({ title: 'Formeln', body: 'x', tags: ['a'], attachments: [{ kind: 'image', name: 'b' }, { kind: 'link', url: 'https://a.de' }] }), 'Kopie')
        expect(copy).toMatchObject({ title: 'Formeln (Kopie)', tags: ['a'], attachments: [{ kind: 'link', url: 'https://a.de' }] })
        expect(noteMarkdown(note({ title: 'Formeln', body: 'Text', tags: ['mathe'] }))).toBe('# Formeln\n\n#mathe\n\nText\n')
        expect(noteFileName(note({ title: 'Größen & Maße!' }))).toBe('grossen-masse.md')
        expect(daysLeftInTrash(note({ trashedAt: '2026-11-01T00:00:00Z' }), Date.parse('2026-11-11T00:00:00Z'))).toBe(20)
    })
})

describe('collections: the store and what is in one', () => {
    const tasks = [
        { id: 10, name: 'Klausur', kind: 'event', due: '2026-11-20', done: false },
        { id: 11, name: 'Lernen', kind: 'task', due: null, done: true },
        { id: 12, name: 'Üben', kind: 'task', due: '2026-11-10', done: false },
    ]
    const col = { id: 3, name: 'Mathe', items: [{ kind: 'task', id: 11 }, { kind: 'task', id: 10 }, { kind: 'note', id: 5 }, { kind: 'task', id: 12 }, { kind: 'task', id: 99 }] }

    it('sorts events by day, open tasks first, and leaves out what is gone', () => {
        const contents = collectionContents(col, tasks, [note({ id: 5, title: 'Formeln' })])
        expect(contents.events.map(task => task.id)).toEqual([10])
        expect(contents.tasks.map(task => task.id)).toEqual([12, 11])
        expect(contents.notes.map(n => n.id)).toEqual([5])
    })

    it('keeps the last changed first and finds the collections of a thing', () => {
        let state = collectionsReducer(undefined, { type: 'SET_COLLECTIONS', payload: [col, { id: 4, name: 'Woche', items: [] }] })
        state = collectionsReducer(state, { type: 'COLLECTION_SAVED', payload: { id: 4, name: 'Woche', items: [{ kind: 'task', id: 12 }] } })
        expect(state.list.map(c => c.id)).toEqual([4, 3])
        expect(collectionsOf(state.list, { kind: 'task', id: 12 }).map(c => c.id)).toEqual([4, 3])
        state = collectionsReducer(state, { type: 'COLLECTION_REMOVED', payload: 3 })
        expect(state.list.map(c => c.id)).toEqual([4])
    })

    it('are listed among the features in test, for testers only', () => {
        for (const id of ['notes', 'collections', 'focusminimize']) {
            expect(TEST_FEATURES.find(feature => feature.id === id)).toMatchObject({ testerOnly: true })
            expect(translations.de[`testerFeature_${id}`]).toBeTruthy()
        }
    })
})

describe('the Fokusraum timer folds while it runs (testers)', () => {
    it('becomes a bar on start and big again on request', async () => {
        serve({})
        const store = makeStore()
        wrap(<FocusTimer />, store, '/focus')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'start timer' })) })
        const expand = screen.getByRole('button', { name: new RegExp(t('focusTimerExpand')) })
        expect(screen.queryByRole('group', { name: t('timerMode') })).toBeNull()
        fireEvent.click(expand)
        expect(screen.getByRole('group', { name: t('timerMode') })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: t('focusTimerMinimize') }))
        expect(screen.getByRole('button', { name: new RegExp(t('focusTimerExpand')) })).toBeTruthy()
    })

    it('stays big for everybody else', async () => {
        serve({})
        wrap(<FocusTimer />, makeStore({ isTester: false }), '/focus')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'start timer' })) })
        expect(screen.queryByRole('button', { name: new RegExp(t('focusTimerExpand')) })).toBeNull()
        expect(screen.getByRole('button', { name: 'pause timer' })).toBeTruthy()
    })
})

describe('the notes area', () => {
    const notes = [
        note({ id: 1, title: 'Analysis', body: 'Ableitungen', folderId: 3, tags: ['klausur'] }),
        note({ id: 2, title: 'Vergessen', body: 'alt', archived: true }),
    ]

    async function openPage(path = '/notes') {
        serve({
            'GET /api/notebook': notes,
            'GET /api/notebook?trash=1': [note({ id: 7, title: 'Weg', trashedAt: new Date().toISOString() })],
            'GET /api/tester/note-folders': [{ id: 3, name: 'Mathe', emoji: '📐', notes: 1 }],
            'GET /api/tester/collections': [],
            'PUT /api/notebook/1': (options) => ({ ...notes[0], ...JSON.parse(options.body), trashedAt: JSON.parse(options.body).trashed ? new Date().toISOString() : null }),
            'POST /api/notebook': (options) => note({ id: 50, ...JSON.parse(options.body) }),
        })
        wrap(<Routes><Route path="/notes" element={<NotesPage />} /></Routes>, makeStore(), path)
        await act(async () => {})
    }

    it('shows the views; archived notes only in the archive, the trash on its own', async () => {
        await openPage()
        const list = screen.getByRole('region', { name: new RegExp(`^${t('notesAll')}`) })
        expect(within(list).getByText('Analysis')).toBeTruthy()
        expect(within(list).queryByText('Vergessen')).toBeNull()
        const views = screen.getByRole('navigation', { name: t('notesViews') })
        fireEvent.click(within(views).getByRole('button', { name: /Archive/ }))
        expect(screen.getByText('Vergessen')).toBeTruthy()
        fireEvent.click(within(views).getByRole('button', { name: /Trash/ }))
        expect(screen.getByText('Weg')).toBeTruthy()
        expect(screen.getByRole('button', { name: t('noteRestore') })).toBeTruthy()
    })

    it('makes a new note in the folder being looked at', async () => {
        await openPage('/notes?view=folder:3')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(t('noteNewLong')) })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/notebook' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toMatchObject({ folderId: 3 })
    })

    it('opens a note with folder, tags and collections, and puts it into the trash', async () => {
        await openPage('/notes?note=1')
        const editor = screen.getByRole('article', { name: 'Analysis' })
        expect(within(editor).getByRole('combobox', { name: t('noteFolder') }).value).toBe('3')
        expect(within(editor).getByText('#klausur')).toBeTruthy()
        expect(within(editor).getByText(t('collectionsIn'))).toBeTruthy()
        await act(async () => { fireEvent.click(within(editor).getByRole('button', { name: /Move to trash/ })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/notebook/1' && options?.method === 'PUT')
        expect(JSON.parse(call[1].body)).toEqual({ trashed: true })
        expect(screen.getByText(t('notesPick'))).toBeTruthy()
    })
})

describe('collections', () => {
    const tasks = [
        { id: 10, name: 'Klausur Mathe', kind: 'event', due: '2026-11-20', due_time: '09:00', done: false, isOwner: true },
        { id: 11, name: 'Kapitel 3 lernen', kind: 'task', due: null, done: false, isOwner: true },
    ]
    const collection = { id: 3, name: 'Klausur Mathe', emoji: '📐', color: null, description: '', items: [{ kind: 'task', id: 10 }, { kind: 'note', id: 5 }] }

    it('shows its events and notes, and puts a task in from the search', async () => {
        serve({
            'GET /api/tester/collections': [collection],
            'GET /api/notebook': [note({ id: 5, title: 'Formelsammlung', body: 'a² + b²' })],
            'POST /api/tester/collections/3/items': (options) => ({ ...collection, items: [...collection.items, JSON.parse(options.body)] }),
        })
        wrap(<Routes><Route path="/collections/:id" element={<Collections />} /></Routes>, makeStore({ tasks }), '/collections/3')
        await act(async () => {})
        expect(screen.getByRole('region', { name: t('collectionSectionEvents') }).textContent).toContain('Klausur Mathe')
        expect(screen.getByRole('link', { name: /Formelsammlung/ }).getAttribute('href')).toBe('/notes?note=5')
        fireEvent.change(screen.getByRole('searchbox', { name: t('collectionSearch') }), { target: { value: 'kapitel' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Kapitel 3 lernen/ })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/tester/collections/3/items' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ kind: 'task', id: 11 })
        expect(screen.getByRole('region', { name: t('collectionSectionTasks') }).textContent).toContain('Kapitel 3 lernen')
    })

    it('can be started from an event in its editor (testers only)', async () => {
        serve({
            'GET /api/tester/collections': [],
            'POST /api/tester/collections': (options) => ({ id: 8, emoji: null, color: null, description: '', ...JSON.parse(options.body), items: JSON.parse(options.body).items }),
        })
        const store = makeStore({ tasks })
        wrap(<TaskEditor task={tasks[0]} onSave={vi.fn()} onCancel={vi.fn()} />, store)
        await act(async () => {})
        fireEvent.change(screen.getByRole('combobox', { name: t('collectionAddTo') }), { target: { value: '__new' } })
        const field = screen.getByRole('textbox', { name: t('collectionName') })
        expect(field.value).toBe('Klausur Mathe')
        await act(async () => { fireEvent.keyDown(field, { key: 'Enter' }) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/tester/collections' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ name: 'Klausur Mathe', items: [{ kind: 'task', id: 10 }] })
        expect(screen.getByRole('link', { name: /Klausur Mathe/ }).getAttribute('href')).toBe('/collections/8')
    })

    it('stay out of the task editor for everybody else', async () => {
        serve({})
        wrap(<TaskEditor task={tasks[1]} onSave={vi.fn()} onCancel={vi.fn()} />, makeStore({ isTester: false, tasks }))
        await act(async () => {})
        expect(screen.queryByText(t('collectionsIn'))).toBeNull()
        expect(apiFetch.mock.calls.some(([url]) => url === '/api/tester/collections')).toBe(false)
    })
})

describe('collections in place of groups (testers)', () => {
    const tasks = [
        { id: 1, name: 'Ableiten', kind: 'task', due: null, done: false, isOwner: true, group_ids: [9] },
        { id: 2, name: 'Einkaufen', kind: 'task', due: null, done: false, isOwner: true, group_ids: [] },
    ]
    const exam = { id: 5, name: 'Klausur', emoji: '📐', color: 'blue', description: 'Hörsaal 2', items: [{ kind: 'task', id: 1 }] }
    const homeStore = (isTester) => {
        const store = makeStore({ isTester })
        store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [{ id: 9, name: 'Uni', description: '', color: null }], notes: [] } })
        return store
    }
    const home = (store) => wrap(<>
        <GroupBtnContainer setCreateGroup={vi.fn()} />
        <TaskContainer handlePointerDown={vi.fn()} setCreateTask={vi.fn()} dragPosition={{ x: 0, y: 0 }} dragOffset={{ x: 0, y: 0 }} />
    </>, store)

    it("Home's chips are my collections; one shows its tasks, which can be taken out again", async () => {
        serve({
            'GET /api/tester/collections': [exam],
            'DELETE /api/tester/collections/5/items/task/1': { ...exam, items: [] },
        })
        home(homeStore(true))
        await act(async () => {})
        const chips = screen.getByRole('group', { name: t('groups') })
        expect(within(chips).queryByRole('button', { name: 'Uni' })).toBeNull()
        // the task's label is the collection too
        expect(screen.getAllByTitle(t('collectionShow'))).toHaveLength(1)

        await act(async () => { fireEvent.click(within(chips).getByRole('button', { name: /Klausur/ })) })
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('📐 Klausur')
        expect(screen.getByText('Hörsaal 2')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: `${t('collectionOpenPage')}: Klausur` }).getAttribute('href')).toBe('/collections/5')
        const list = screen.getByRole('list', { name: t('toDo') })
        expect(list.textContent).toContain('Ableiten')
        // the other row leaves (after its way out)
        await waitFor(() => expect(list.textContent).not.toContain('Einkaufen'))

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${t('collectionRemoveTask')}: Ableiten` })) })
        expect(apiFetch.mock.calls.some(([url, options]) => url === '/api/tester/collections/5/items/task/1' && options?.method === 'DELETE')).toBe(true)
        await waitFor(() => expect(screen.queryByRole('list', { name: t('toDo') })).toBeNull())
    })

    it('stay groups for everybody else', async () => {
        serve({})
        home(homeStore(false))
        await act(async () => {})
        expect(within(screen.getByRole('group', { name: t('groups') })).getByRole('button', { name: 'Uni' })).toBeInTheDocument()
        expect(apiFetch.mock.calls.some(([url]) => url === '/api/tester/collections')).toBe(false)
    })

    it('"+" makes a collection', async () => {
        serve({
            'GET /api/tester/collections': [],
            'POST /api/tester/collections': (options) => ({ id: 6, emoji: null, items: [], ...JSON.parse(options.body) }),
        })
        const close = vi.fn()
        wrap(<GroupForm setCreateGroup={close} />, homeStore(true))
        expect(screen.getByRole('heading', { name: t('collectionNew') })).toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText(t('collectionName')), { target: { value: ' Referat ' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: t('createBtn') })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/tester/collections' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ name: 'Referat', description: '', color: null })
        expect(close).toHaveBeenCalledWith(false)
        expect(apiFetch.mock.calls.some(([url]) => url === '/api/groups')).toBe(false)
    })

    it('the calendar filters by whatever a task is sorted into', () => {
        const inGroup = (task, id) => id === 'collection-5' && task.id === 1
        expect(filterTasks(tasks, { groupId: 'collection-5', inGroup }).map(task => task.id)).toEqual([1])
        expect(filterTasks(tasks, { groupId: 9 }).map(task => task.id)).toEqual([1])
    })
})
