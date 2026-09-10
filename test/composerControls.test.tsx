import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MODEL_NAMES, ModelPicker } from '../components/start/composer-controls'

/**
 * The model picker under the box.
 *
 * A closed menu is hidden from the keyboard, which means the option holding
 * the focus loses it — so the button that opened the menu has to take it
 * back, or the next Tab starts again at the top of the page. Devin's finding
 * on #90, and both cases here fail without the fix.
 */

afterEach(cleanup)

function Picker() {
  const [model, setModel] = useState<string>(MODEL_NAMES[0])
  return <ModelPicker value={model} onChange={setModel} />
}

const trigger = () => screen.getByRole('button', { name: /^Model:/ })
const option = (name: string) => screen.getByRole('menuitemradio', { name })

describe('closing the model menu', () => {
  it('hands the focus back to the button when an option is chosen', async () => {
    const person = userEvent.setup()
    render(<Picker />)

    await person.tab()
    expect(document.activeElement).toBe(trigger())
    await person.keyboard('{Enter}')
    await person.tab()
    await person.tab()
    expect(document.activeElement).toBe(option(MODEL_NAMES[1]))

    await person.keyboard('{Enter}')

    expect(document.activeElement).toBe(trigger())
    expect(trigger().getAttribute('aria-label')).toBe(`Model: ${MODEL_NAMES[1]}`)
  })

  it('hands the focus back to the button on Escape', async () => {
    const person = userEvent.setup()
    render(<Picker />)

    await person.tab()
    await person.keyboard('{Enter}')
    await person.tab()
    expect(document.activeElement).toBe(option(MODEL_NAMES[0]))

    await person.keyboard('{Escape}')

    expect(document.activeElement).toBe(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })
})
