import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import Social from '../components/Social'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const anna = { id: 2, username: 'anna', displayName: 'Anna Berg', since: '2026-10-01T10:00:00Z' }
const ben = { id: 3, username: 'ben', displayName: null }

// Answers the API like the backend would for a given starting state
function mockApi({ friends = [], incoming = [], outgoing = [] } = {}) {
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/friends') return friends
        if (url === '/api/friends/requests' && !options.method) return { incoming, outgoing }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
}

async function renderSocial(path = '/social') {
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[path]}><Social /></MemoryRouter>
            </Provider>
        )
    })
    return store
}

const tab = (name) => screen.getByRole('tab', { name: new RegExp(name) })

describe('Social page', () => {
    beforeEach(() => { apiFetch.mockReset() })

    it('loads friends and requests when opened', async () => {
        mockApi({ friends: [anna] })
        await renderSocial()
        expect(apiFetch).toHaveBeenCalledWith('/api/friends')
        expect(apiFetch).toHaveBeenCalledWith('/api/friends/requests')
        expect(screen.getByText('Anna Berg')).toBeInTheDocument()
        expect(screen.getByText(/@anna · Freunde seit/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Anna Berg' })).toHaveAttribute('href', '/u/anna')
    })

    it('shows how many requests are waiting on the Requests tab', async () => {
        mockApi({ incoming: [{ id: 10, user: ben, createdAt: '2026-10-18T10:00:00Z' }] })
        await renderSocial()
        expect(within(tab('Anfragen')).getByText('1')).toBeInTheDocument()
    })

    it('with no friends, offers a way to add some', async () => {
        mockApi()
        await renderSocial()
        expect(screen.getByText('Noch keine Freunde.')).toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: 'Hinzufügen' }).at(-1))

        expect(tab('Hinzufügen')).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByLabelText('Benutzer Name')).toBeInTheDocument()
    })

    it('opens the tab named in the URL, so the menu badge can link to the inbox', async () => {
        mockApi()
        await renderSocial('/social?tab=requests')
        expect(tab('Anfragen')).toHaveAttribute('aria-selected', 'true')
    })

    describe('adding', () => {
        it('sends a request and confirms it', async () => {
            mockApi()
            await renderSocial('/social?tab=add')
            apiFetch.mockResolvedValueOnce({ status: 'pending', request: { id: 30, user: ben, createdAt: '2026-10-18' } })

            fireEvent.change(screen.getByLabelText('Benutzer Name'), { target: { value: ' @ben ' } })
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anfrage senden' })) })

            expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ username: 'ben' })
            expect(screen.getByRole('status')).toHaveTextContent('Anfrage gesendet an @ben')
            expect(screen.getByLabelText('Benutzer Name')).toHaveValue('')
        })

        it('shows a translated message for an unknown username', async () => {
            mockApi()
            await renderSocial('/social?tab=add')
            apiFetch.mockRejectedValueOnce(Object.assign(new Error('User not found'), { status: 404, code: 'USER_NOT_FOUND' }))

            fireEvent.change(screen.getByLabelText('Benutzer Name'), { target: { value: 'nobody' } })
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anfrage senden' })) })

            expect(screen.getByRole('status')).toHaveTextContent('Diesen Benutzernamen gibt es nicht.')
            expect(screen.getByLabelText('Benutzer Name')).toHaveValue('nobody') // kept for correcting
        })

        it('falls back to a general message for unexpected errors', async () => {
            mockApi()
            await renderSocial('/social?tab=add')
            apiFetch.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))

            fireEvent.change(screen.getByLabelText('Benutzer Name'), { target: { value: 'ben' } })
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anfrage senden' })) })

            expect(screen.getByRole('status')).toHaveTextContent('Das hat nicht geklappt')
        })

        it('cannot send an empty username', async () => {
            mockApi()
            await renderSocial('/social?tab=add')
            expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeDisabled()
        })
    })

    describe('requests', () => {
        it('accepting moves the person to the friends list', async () => {
            mockApi({ incoming: [{ id: 10, user: ben, createdAt: '2026-10-18T10:00:00Z' }] })
            await renderSocial('/social?tab=requests')
            apiFetch.mockResolvedValueOnce({ friend: { ...ben, since: '2026-10-18T12:00:00Z' } })

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annehmen' })) })

            expect(apiFetch).toHaveBeenLastCalledWith('/api/friends/requests/10/accept', { method: 'POST' })
            expect(screen.queryByRole('button', { name: 'Annehmen' })).not.toBeInTheDocument()
            fireEvent.click(tab('Freunde'))
            expect(screen.getByText(/@ben · Freunde seit/)).toBeInTheDocument()
        })

        it('declining removes the request', async () => {
            mockApi({ incoming: [{ id: 10, user: ben, createdAt: '2026-10-18T10:00:00Z' }] })
            await renderSocial('/social?tab=requests')
            apiFetch.mockResolvedValueOnce({ id: 10 })

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' })) })

            expect(apiFetch).toHaveBeenLastCalledWith('/api/friends/requests/10', { method: 'DELETE' })
            expect(screen.getAllByText('Keine offenen Anfragen.')).toHaveLength(2)
        })

        it('lists sent requests as pending, with a way to withdraw them', async () => {
            mockApi({ outgoing: [{ id: 11, user: ben, createdAt: '2026-10-18T10:00:00Z' }] })
            await renderSocial('/social?tab=requests')
            expect(screen.getByText('@ben · Ausstehend')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Zurückziehen' })).toBeInTheDocument()
        })
    })

    describe('removing a friend', () => {
        it('asks first, and only removes after confirming', async () => {
            mockApi({ friends: [anna] })
            await renderSocial()

            fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
            expect(screen.getByText('Wirklich entfernen?')).toBeInTheDocument()
            expect(apiFetch).not.toHaveBeenCalledWith('/api/friends/2', { method: 'DELETE' })

            apiFetch.mockResolvedValueOnce({ userId: 2 })
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Entfernen' })) })

            expect(apiFetch).toHaveBeenLastCalledWith('/api/friends/2', { method: 'DELETE' })
            expect(screen.queryByText('Anna Berg')).not.toBeInTheDocument()
        })

        it('can be called off', async () => {
            mockApi({ friends: [anna] })
            await renderSocial()
            fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
            fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
            expect(screen.queryByText('Wirklich entfernen?')).not.toBeInTheDocument()
            expect(screen.getByText('Anna Berg')).toBeInTheDocument()
        })
    })
})
