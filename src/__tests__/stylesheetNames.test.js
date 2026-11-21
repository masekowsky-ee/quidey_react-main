import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ACCENTS, ACCENT_SWATCHES, PALETTES, PALETTE_NAMES } from '../features/settings/preferences'
import { TASK_COLORS } from '../features/tasks/taskColors'

// The settings' swatches and the attribute values components set are written twice: in JS and in
// index.css. This guards the link between them (a renamed or retuned one would silently go wrong).
const css = readFileSync('src/index.css', 'utf8')

function declarations(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css)
    return match ? match[1] : null
}
const variable = (block, name) => block?.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1]?.toLowerCase()

describe('accents in index.css', () => {
    it('has a rule for every accent', () => {
        for (const accent of ACCENTS) expect(css, accent).toContain(`[data-accent="${accent}"]`)
    })

    it('shows each swatch in the accent\'s dark colour', () => {
        expect(ACCENT_SWATCHES.map(swatch => swatch.value).sort()).toEqual([...ACCENTS].sort())
        for (const { value, color } of ACCENT_SWATCHES) {
            expect(variable(declarations(`:root[data-accent="${value}"]`), '--primary'), value).toBe(color)
        }
    })
})

describe('palettes in index.css', () => {
    it('has a rule for every palette that is not the default ground', () => {
        for (const name of PALETTE_NAMES.filter(name => name !== 'warm')) {
            expect(css, name).toContain(`[data-palette="${name}"]`)
        }
    })

    it('shows each swatch as the palette\'s page, card and heading colour', () => {
        for (const name of PALETTE_NAMES.filter(name => name !== 'warm')) {
            for (const [theme, selector] of [['dark', `:root[data-palette="${name}"]`], ['light', `:root[data-theme="light"][data-palette="${name}"]`]]) {
                const block = declarations(selector)
                const [page, card, text] = PALETTES[name][theme]
                expect(variable(block, '--bg'), `${name} ${theme} page`).toBe(page)
                expect(variable(block, '--text-h'), `${name} ${theme} text`).toBe(text)
                // on a page as white as the card (mono, light) the swatch shows the card as the inset grey
                expect([variable(block, '--surface'), variable(block, '--surface-inset')], `${name} ${theme} card`).toContain(card)
            }
        }
    })
})

describe('task colours in index.css', () => {
    it('has a rule for every colour name', () => {
        for (const color of TASK_COLORS) expect(css, color).toContain(`[data-task-color="${color}"]`)
    })
})
