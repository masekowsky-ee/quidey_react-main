import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TIPS } from '../features/tips/tips'

// A tip points at an element by an attribute ([data-tip="…"], [data-part="…"]); rename the
// attribute in the markup and the tip is silently never shown. This checks that every value a tip
// looks for is written in the source (the files other than tips.js itself).
const TARGET_ATTRIBUTES = ['data-tip', 'data-part']
// built from pieces, so the full name is never written out
const BUILT_NAMES = new Set([
    'kind-reminder', // components/task/KindFields.jsx: `kind-${kind}`
    'study-grades', // components/study/SubjectList.jsx: built from a prefix
])

function sourceFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (name === '__tests__' || name === 'node_modules') return []
        return statSync(path).isDirectory() ? sourceFiles(path) : /\.(jsx|js)$/.test(name) && !path.endsWith(join('tips', 'tips.js')) ? [path] : []
    })
}
const source = sourceFiles('src').map(path => readFileSync(path, 'utf8')).join('\n')

const wanted = TIPS.flatMap(tip => TARGET_ATTRIBUTES.flatMap(attribute =>
    [...String(tip.target).matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(match => ({ id: tip.id, attribute, value: match[1] }))))

describe('tip targets', () => {
    it('finds the tips\' selectors', () => {
        expect(wanted.length).toBeGreaterThan(30)
    })

    it.each(wanted)('$id: $attribute="$value" is in the markup', ({ attribute, value }) => {
        if (BUILT_NAMES.has(value)) return
        // data-tip="x", data-tip={'x'}, a `tip="x"` prop handed on to it or { 'data-tip': 'x' } (also inside a condition: `? 'x'`)
        const direct = new RegExp('(?:' + attribute + (attribute === 'data-tip' ? '|\\btip' : '') + ')["\']?\\s*[=:]\\s*\\{?[^\\n]{0,80}?["\'`]' + value + '["\'`]')
        const found = direct.test(source)
        expect(found).toBe(true)
    })
})
