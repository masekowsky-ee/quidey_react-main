// Adds DOM matchers like toBeInTheDocument() to Vitest's expect.
// The /vitest entry registers them without needing global test functions.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount rendered components between tests so they don't leak into each other
afterEach(() => cleanup())
