import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A stand-in for the Web Audio API that records the notes started
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
const node = (extra = {}) => ({ connect: (target) => target, ...extra })

function fakeAudio(state = 'running') {
    const started = []
    class FakeAudioContext {
        state = state
        currentTime = 0
        sampleRate = 8000
        destination = node()
        resume = vi.fn(() => { this.state = 'running'; return Promise.resolve() })
        createGain() { return node({ gain: param() }) }
        createDelay() { return node({ delayTime: param() }) }
        createBiquadFilter() { return node({ frequency: param(), Q: param() }) }
        createDynamicsCompressor() { return node({ threshold: param(), ratio: param() }) }
        createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data } }
        createBufferSource() { return node({ start: () => started.push('noise'), stop() {} }) }
        createOscillator() {
            const frequency = param()
            frequency.setValueAtTime = (value) => { frequency.value = value }
            return node({ frequency, start: () => started.push(frequency.value), stop() {} })
        }
    }
    window.AudioContext = FakeAudioContext
    return started
}

const load = async () => {
    vi.resetModules()
    return import('../features/settings/sound')
}

beforeEach(() => {
    localStorage.clear()
})

afterEach(() => {
    delete window.AudioContext
})

describe('sounds', () => {
    it('are soft by default and remember the chosen level', async () => {
        const { readStoredSound, storeSound } = await load()
        expect(readStoredSound()).toBe('soft')
        storeSound('off')
        expect(readStoredSound()).toBe('off')
        localStorage.setItem('sound', 'loud')
        expect(readStoredSound()).toBe('soft')
    })

    it('play the motif, E then A, when a task is done', async () => {
        const started = fakeAudio()
        const { playSound } = await load()
        playSound('done')
        const notes = started.filter(f => typeof f === 'number').map(Math.round)
        expect(notes).toContain(659) // E5
        expect(notes).toContain(880) // A5
        expect(notes.indexOf(659)).toBeLessThan(notes.indexOf(880))
    })

    it('every one of them plays', async () => {
        const started = fakeAudio()
        const { playSound, SOUND_NAMES } = await load()
        for (const name of SOUND_NAMES) {
            const before = started.length
            playSound(name)
            expect(started.length, name).toBeGreaterThan(before)
        }
    })

    it('stay silent when off, in the background, unknown, or twice at once', async () => {
        const started = fakeAudio()
        const { playSound, storeSound } = await load()
        playSound('nope')
        expect(started).toHaveLength(0)

        playSound('done')
        const once = started.length
        playSound('done')
        expect(started).toHaveLength(once)

        storeSound('off')
        playSound('levelUp')
        expect(started).toHaveLength(once)

        storeSound('full')
        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        playSound('levelUp')
        hidden.mockRestore()
        expect(started).toHaveLength(once)
    })

    it('do nothing where the browser has no Web Audio', async () => {
        const { playSound } = await load()
        expect(() => playSound('done')).not.toThrow()
    })

    it('wait for the audio to be unlocked instead of piling up', async () => {
        const started = fakeAudio('suspended')
        const { playSound } = await load()
        playSound('message')
        expect(started).toHaveLength(0)
        await Promise.resolve()
        await Promise.resolve()
        expect(started.length).toBeGreaterThan(0)
    })
})
