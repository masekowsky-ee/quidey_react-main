import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { setLanguage } from '../features/settings/settingsAction'
import { apiFetch } from '../features/helperFunction'
import LegalPage from '../legal/LegalPage'
import { OWNER, LEGAL_VERSION_DATE } from '../legal/owner'

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

describe('privacy page: study goals', () => {
    // The language is read from localStorage only when the settings reducer loads, so set it on the store.
    const renderPrivacyIn = (lang) => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage(lang))
        return render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/datenschutz']}><LegalPage /></MemoryRouter>
            </Provider>
        )
    }

    it.each([
        ['de', false],
        ['en', true],
    ])('names Anthropic for the AI estimates and the study push kind (%s)', (lang, englishNote) => {
        const { container } = renderPrivacyIn(lang)
        const text = container.textContent
        expect(text).toContain('KI-Schätzungen')
        expect(text).toContain('Anthropic')
        expect(text).toContain('Art. 6 Abs. 1 lit. a DSGVO')

        const push = [...container.querySelectorAll('p')]
            .find((p) => p.textContent.includes('Benachrichtigungen auf deinem Gerät (Push)'))
        expect(push).toBeDefined()
        expect(push.textContent).toContain('in der Art „Lernen“')
        expect(push.textContent).toContain('hinter dem Plan')

        const note = container.querySelector('p[lang="en"]')
        if (englishNote) expect(note?.textContent).toBe('This legal information is provided in German, as required by German law.')
        else expect(note).toBeNull()
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

describe('anonymous usage statistics in the legal texts', () => {
    const textOf = (path) => renderAt(path).container.textContent
    const norm = (t) => t.replace(/\s+/g, ' ')

    it('has the current version date', () => {
        expect(LEGAL_VERSION_DATE).toBe('07.11.2026 (anonyme Nutzungsstatistik mit Einwilligung)')
    })

    it('the privacy page explains the opt-in statistics', () => {
        const text = norm(textOf('/datenschutz'))
        expect(text).toContain('Mit deiner Einwilligung zählt Quidey anonym mit, wann und welche Bereiche genutzt werden: nur Summen, ohne Bezug zu dir, auf dem eigenen Server (Abschnitt 4).')
        expect(text).not.toContain('Im Browser gibt es kein Tracking')
        expect(screen.getByRole('heading', { name: '4. Anonyme Nutzungsstatistik (nur mit Einwilligung)' })).toBeInTheDocument()
        for (const part of [
            'höchstens 8 Tage', 'ohne zeitliche Begrenzung', 'Art. 6 Abs. 1 lit. a DSGVO', '§ 25 Abs. 1 TDDDG',
            'Einstellungen → Datenschutz', 'Anonyme Nutzungsstatistik', 'Aufgabe angelegt', 'Fokuszeit',
            'keine Cookies', 'Plan (kostenlos, Tester oder Pro)',
        ]) expect(text).toContain(part)
        expect(text).not.toContain('2 Stunden')
        expect(text).not.toContain('<3')
    })

    it('numbers the privacy sections one after the other', () => {
        renderAt('/datenschutz')
        const numbers = screen.getAllByRole('heading', { level: 2 }).map((h) => parseInt(h.textContent, 10))
        expect(numbers).toEqual(numbers.map((_, i) => i + 1))
    })

    it('the terms say the statistics are optional', () => {
        const text = norm(textOf('/nutzungsbedingungen'))
        expect(text).toContain('Die anonyme Nutzungsstatistik ist freiwillig; alle Funktionen von Quidey funktionieren genauso, wenn du sie nicht einschaltest.')
    })
})
