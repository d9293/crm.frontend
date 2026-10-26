/**
 * Prototype render tests.
 *
 * The prototype is a review artefact, so the thing worth testing is that it
 * actually renders the journey and states the right things about itself —
 * particularly that it does not present simulated behaviour as real.
 */

import { describe, expect, it } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { ThemeProvider } from '../../theme/ThemeProvider'
import Prototype from './Prototype'

/**
 * The prototype carries a theme switcher, so it needs the theme context the
 * real app provides around every route. Only that one provider: the prototype
 * deliberately needs no session, because it authorizes nothing.
 */
function render() {
  return rtlRender(
    <ThemeProvider>
      <Prototype />
    </ThemeProvider>,
  )
}

describe('journey prototype', () => {
  it('renders both sides of the hold', () => {
    render()

    // Side-by-side is the point: the hold is a two-party interaction.
    expect(screen.getByRole('heading', { level: 2, name: 'Клиент' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Сотрудник' })).toBeTruthy()
  })

  it('says plainly that it is not a working system', () => {
    render()

    expect(screen.getByText(/Это макет, а не работающая система/)).toBeTruthy()
    expect(screen.getByText(/не является эталонной реализацией/)).toBeTruthy()
  })

  it('defaults to the confirmed five-minute hold', () => {
    render()

    const select = screen.getByLabelText('Длительность удержания') as HTMLSelectElement
    expect(select.value).toBe('300')
    // The shortened option exists for demonstration but is not the default,
    // so a reviewer never sees a rule that differs from BR-04 by accident.
    expect(screen.queryByText(/Удержание сокращено для демонстрации/)).toBeNull()
  })

  it('offers court slots and an empty approval queue to begin with', () => {
    render()

    // By heading, not by text: every slot's accessible name also contains the
    // court name, so a bare text query matches dozens of elements.
    expect(screen.getByRole('heading', { level: 3, name: /Корт 1/ })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Корт 1.*Свободно/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('Заявок, ожидающих решения, нет.')).toBeTruthy()
  })

  it('states that selecting a slot creates no hold', () => {
    render()

    // The distinction a customer most easily misreads: a highlighted slot is
    // not a reservation (UX-01).
    expect(screen.getByText(/Выбор времени пока ничего не удерживает/)).toBeTruthy()
  })
})
