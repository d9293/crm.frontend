/**
 * Test setup.
 *
 * Testing Library normally registers its own `afterEach(cleanup)` through
 * Vitest's globals. This project runs with `globals: false` — explicit imports
 * over ambient magic — so the cleanup hook has to be registered here.
 *
 * Without it, every `render` accumulates in the same document and later
 * queries match elements left behind by earlier tests, which produces
 * confusing "multiple elements found" failures rather than honest ones.
 */

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  // Theme writes `data-theme` on the document root; clear it so a test that
  // sets an explicit theme cannot affect the next one.
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
})
