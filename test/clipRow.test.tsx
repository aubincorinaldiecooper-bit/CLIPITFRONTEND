import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ClipRow } from '../components/clip-row'

/**
 * One row of the library: title, count, two arrows, "Show all", and the
 * cards scrolling sideways under it.
 */

afterEach(cleanup)

const row = () =>
  render(
    <ClipRow title="Sunday five-a-side" count={2}>
      <div key="a">card a</div>
      <div key="b">card b</div>
    </ClipRow>,
  )

describe('a library row', () => {
  it('shows its title, its count and its cards', () => {
    row()
    expect(screen.getByRole('heading', { name: /Sunday five-a-side/ })).toBeTruthy()
    expect(screen.getByText('· 2')).toBeTruthy()
    expect(screen.getByText('card a')).toBeTruthy()
    expect(screen.getByText('card b')).toBeTruthy()
  })

  it('starts at the beginning, so the back arrow is off', () => {
    row()
    const back = screen.getByRole('button', { name: /back/ }) as HTMLButtonElement
    expect(back.disabled).toBe(true)
  })

  it('"Show all" lays the cards out in place and puts the arrows away; "Show less" folds them back', () => {
    row()
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.queryByRole('button', { name: /back/ })).toBeNull()
    expect(screen.getByText('card b')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getByRole('button', { name: /back/ })).toBeTruthy()
  })
})
