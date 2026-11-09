import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import RichNoteEditor from '../components/notes/RichNoteEditor'

// The notes' editor: the text without visible marks, stored as the same lines as before
const setup = (body, props = {}) => {
    let getBody = null
    const onChange = vi.fn(getter => { getBody = getter })
    render(
        <Provider store={configureStore({ reducer: rootReducer })}>
            <RichNoteEditor body={body} onChange={onChange} label="Text der Notiz" {...props} />
        </Provider>
    )
    const box = screen.getByRole('textbox', { name: 'Text der Notiz' })
    return { box, editor: box.editor, onChange, body: () => getBody?.() }
}

const tool = (name) => within(screen.getByRole('toolbar')).getByRole('button', { name })

describe('the notes editor', () => {
    it('shows headings, checklists and bold without their marks', () => {
        const { box } = setup('# Kapitel 4\n- [ ] lesen\n- [x] markieren\nEin **wichtiger** Satz')
        expect(within(box).getByRole('heading', { level: 1, name: 'Kapitel 4' })).toBeInTheDocument()
        const boxes = within(box).getAllByRole('checkbox')
        expect(boxes.map(item => item.checked)).toEqual([false, true])
        expect(within(box).getByText('wichtiger').tagName).toBe('STRONG')
        expect(box.textContent).not.toMatch(/#|\[ \]|\*\*/)
    })

    it('hands over what was written as the stored lines', () => {
        const { editor, onChange, body } = setup('')
        act(() => { editor.commands.insertContent('Hallo Welt') })
        expect(onChange).toHaveBeenCalled()
        expect(body()).toBe('Hallo Welt')
    })

    it('a heading button turns the line into a heading and back', () => {
        const { editor, body } = setup('Zusammenfassung')
        act(() => { editor.commands.setTextSelection(3) })
        fireEvent.click(tool('Überschrift'))
        expect(body()).toBe('# Zusammenfassung')
        expect(tool('Überschrift')).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(tool('Überschrift'))
        expect(body()).toBe('Zusammenfassung')
    })

    it('makes checklists, lists and bold from the toolbar', () => {
        const { editor, body } = setup('lesen')
        act(() => { editor.commands.setTextSelection(2) })
        fireEvent.click(tool('Checkliste'))
        expect(body()).toBe('- [ ] lesen')
        act(() => { editor.commands.selectAll() })
        fireEvent.click(tool('Fett'))
        expect(body()).toBe('- [ ] **lesen**')
    })

    it('keeps the rarer formats behind "Mehr Formate"', () => {
        const { editor, body } = setup('Zitat')
        expect(screen.queryByRole('button', { name: 'Zitat' })).toBeNull()
        act(() => { editor.commands.setTextSelection(2) })
        fireEvent.click(tool('Mehr Formate'))
        fireEvent.click(screen.getByRole('button', { name: 'Zitat' }))
        expect(body()).toBe('> Zitat')
        expect(screen.queryByRole('button', { name: 'Trennlinie' })).toBeNull()
    })

    it('ticks a checklist line right in the text', () => {
        const { box, body } = setup('- [ ] lesen')
        fireEvent.click(within(box).getByRole('checkbox'))
        expect(body()).toBe('- [x] lesen')
    })

    it('gives the extra tools the text of the cursor\'s line', () => {
        const onPlan = vi.fn()
        const { editor } = setup('# Titel\nLernen morgen 14 Uhr', {
            tools: ({ currentLine }) => <button type="button" onClick={() => onPlan(currentLine())}>Als Aufgabe planen</button>,
        })
        act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 2) })
        fireEvent.click(tool('Als Aufgabe planen'))
        expect(onPlan).toHaveBeenCalledWith('Lernen morgen 14 Uhr')
    })

    it('hands pasted pictures and a pasted link on', () => {
        const onPasteFiles = vi.fn()
        const onPasteLink = vi.fn()
        const { box, body } = setup('', { onPasteFiles, onPasteLink })
        const image = new File(['x'], 'bild.png', { type: 'image/png' })
        fireEvent.paste(box, { clipboardData: { files: [image], types: ['Files'], getData: () => '' } })
        expect(onPasteFiles).toHaveBeenCalledWith([image])
        fireEvent.paste(box, { clipboardData: { files: [], types: ['text/plain'], getData: (type) => (type === 'text/plain' || type === 'text' ? 'https://quidey.com' : '') } })
        expect(onPasteLink).toHaveBeenCalledWith('https://quidey.com')
        expect(body() ?? '').not.toContain('bild.png')
    })
})
