import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import LegalPage from '../legal/LegalPage'
import { OWNER } from '../legal/owner'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const renderAt = (path) => render(
    <Provider store={configureStore({ reducer: rootReducer })}>
        <MemoryRouter initialEntries={[path]}><LegalPage /></MemoryRouter>
    </Provider>
)
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('legal pages', () => {
    it('the Impressum names the operator and two ways to reach them', () => {
        renderAt('/impressum')
        expect(screen.getByRole('heading', { name: 'Impressum' })).toBeInTheDocument()
        expect(screen.getAllByText(OWNER.name, { exact: false }).length).toBeGreaterThan(0)
        expect(screen.getAllByText(OWNER.email, { exact: false }).length).toBeGreaterThan(0)
        expect(screen.getAllByRole('link', { name: 'app.quidey.com/kontakt' })[0]).toHaveAttribute('href', '/kontakt')
    })

    it('every page links to all the others in the footer', () => {
        renderAt('/datenschutz')
        for (const [name, href] of [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Nutzungsbedingungen', '/nutzungsbedingungen'], ['Kontakt', '/kontakt']]) {
            expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
        }
    })
})

describe('contact form', () => {
    beforeEach(() => apiFetch.mockReset())

    const fill = () => {
        type('Name', 'Ann')
        type('E-Mail-Adresse', 'ann@example.com')
        type('Nachricht', 'Hallo, ich habe eine Frage zu Quidey.')
    }

    it('sends the message and thanks', async () => {
        renderAt('/kontakt')
        fill()
        apiFetch.mockResolvedValueOnce({ sent: true })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' })) })

        expect(apiFetch).toHaveBeenCalledWith('/api/contact', expect.objectContaining({ method: 'POST' }))
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
            name: 'Ann', email: 'ann@example.com', message: 'Hallo, ich habe eine Frage zu Quidey.', website: '',
        })
        expect(screen.getByText(/Deine Nachricht ist angekommen/)).toBeInTheDocument()
    })

    it('refuses a too short message before sending', async () => {
        renderAt('/kontakt')
        fill()
        type('Nachricht', 'Hi')
        await act(async () => { fireEvent.submit(screen.getByLabelText('Nachricht').closest('form')) })
        expect(apiFetch).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('10 bis 5000 Zeichen')
    })

    it('explains when sending fails and keeps what was typed', async () => {
        renderAt('/kontakt')
        fill()
        apiFetch.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429, code: 'RATE_LIMITED' }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' })) })
        expect(screen.getByRole('alert')).toHaveTextContent('Zu viele Nachrichten')
        expect(screen.getByLabelText('Nachricht')).toHaveValue('Hallo, ich habe eine Frage zu Quidey.')
    })
})
