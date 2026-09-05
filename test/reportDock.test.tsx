import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportDock } from '../components/workspace/report-dock'
import { setReportContext } from '../lib/report-context'

/**
 * The report dock takes the words, sends them with where they were typed
 * and what was on screen, and says exactly what happened to them.
 */

const { sendReport } = vi.hoisted(() => ({ sendReport: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { sendReport }, ApiError: class ApiError extends Error {} }))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
})

afterEach(() => {
  cleanup()
  sendReport.mockReset()
  setReportContext({ videoId: null, clipRequestId: null })
})

const status = () => screen.getByTestId('report-status').textContent

describe('ReportDock', () => {
  it('opens from its button, and from R — but not while the person is typing elsewhere', async () => {
    render(
      <>
        <input aria-label="elsewhere" />
        <ReportDock />
      </>,
    )
    expect(status()).toContain('Something not working?')
    expect(screen.queryByLabelText('What went wrong')).toBeNull()

    fireEvent.keyDown(screen.getByLabelText('elsewhere'), { key: 'r' })
    expect(screen.queryByLabelText('What went wrong')).toBeNull()

    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByLabelText('What went wrong')).toBeTruthy()
    // The status line changes with a short fade; wait for the new words.
    await waitFor(() => expect(status()).toContain('What were you doing'))

    fireEvent.keyDown(window, { key: 'Escape' })
    // The box leaves with a short collapse; wait for it to be gone.
    await waitFor(() => expect(screen.queryByLabelText('What went wrong')).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    expect(screen.getByLabelText('What went wrong')).toBeTruthy()
  })

  it('sends the words with where they were typed and what was on screen, and says so', async () => {
    sendReport.mockResolvedValue({ report: { id: 'r-1', handedOff: false } })
    setReportContext({ videoId: 'v-1', clipRequestId: 'q-1' })
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    await userEvent.type(screen.getByLabelText('What went wrong'), 'I kept video 4 and it never cut{enter}')
    await waitFor(() => expect(sendReport).toHaveBeenCalledTimes(1))
    expect(sendReport).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'I kept video 4 and it never cut', page: '/', videoId: 'v-1', clipRequestId: 'q-1' }),
    )
    await waitFor(() => expect(status()).toContain('Got it'))
    // The box has gone, and comes back empty for the next one.
    await waitFor(() => expect(screen.queryByLabelText('What went wrong')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    expect((screen.getByLabelText('What went wrong') as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps the box in place while the words are on their way', async () => {
    let finish: (value: unknown) => void = () => {}
    sendReport.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    await userEvent.type(screen.getByLabelText('What went wrong'), 'the page went blank{enter}')
    await waitFor(() => expect(status()).toContain('Sending'))
    // Still open, its controls held, nothing moved.
    expect((screen.getByLabelText('What went wrong') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Send/ }) as HTMLButtonElement).disabled).toBe(true)
    finish({ report: { id: 'r-3', handedOff: false } })
    await waitFor(() => expect(status()).toContain('Got it'))
  })

  it('keeps the words when the report did not arrive, and says it did not', async () => {
    sendReport.mockRejectedValue(new Error('offline'))
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    await userEvent.type(screen.getByLabelText('What went wrong'), 'the page went blank{enter}')
    await waitFor(() => expect(status()).toContain("Couldn't send"))
    expect((screen.getByLabelText('What went wrong') as HTMLTextAreaElement).value).toBe('the page went blank')
    // Still open, and Send tries again.
    sendReport.mockResolvedValue({ report: { id: 'r-2', handedOff: true } })
    await userEvent.click(screen.getByRole('button', { name: /Send/ }))
    await waitFor(() => expect(status()).toContain('Got it'))
    expect(sendReport).toHaveBeenCalledTimes(2)
  })

  it('refuses a report longer than the server takes, whole, with the words kept', async () => {
    // Devin's finding on #88: a long report was shortened to a prefix and confirmed as sent.
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    const box = screen.getByLabelText('What went wrong') as HTMLTextAreaElement
    const long = 'x'.repeat(2001)
    fireEvent.change(box, { target: { value: long } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(status()).toContain('over 2,000 characters'))
    expect(sendReport).not.toHaveBeenCalled()
    expect(box.value).toBe(long)
    // Trimmed under the line, it sends as written.
    sendReport.mockResolvedValue({ report: { id: 'r-4', handedOff: false } })
    fireEvent.change(box, { target: { value: 'x'.repeat(2000) } })
    await waitFor(() => expect(status()).toContain('What were you doing'))
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(sendReport).toHaveBeenCalledTimes(1))
    expect(sendReport.mock.calls[0]![0].message).toHaveLength(2000)
  })

  it('counts a report the way its counter does: an emoji is one character, not two', async () => {
    // The box's counter (Astryx's) counts what a person sees. The refusal
    // must count the same way, or words the counter calls 2,000 would be
    // refused as over.
    sendReport.mockResolvedValue({ report: { id: 'r-5', handedOff: false } })
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    const box = screen.getByLabelText('What went wrong') as HTMLTextAreaElement
    const words = `${'x'.repeat(1999)}👍`
    expect(words).toHaveLength(2001)
    fireEvent.change(box, { target: { value: words } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(sendReport).toHaveBeenCalledTimes(1))
    expect(sendReport.mock.calls[0]![0].message).toBe(words)
  })

  it('takes two thousand of the longest common emoji, and holds the line only a run of combining marks can reach', async () => {
    // Devin's finding on #95: an outer bound on storage must not refuse what
    // the counter calls valid. A family emoji is eleven storage units and one
    // character; two thousand of them send whole. One letter under a run of
    // combining marks is one character of any length, and is refused with
    // words that do not claim it is over 2,000 characters.
    sendReport.mockResolvedValue({ report: { id: 'r-6', handedOff: false } })
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    const box = screen.getByLabelText('What went wrong') as HTMLTextAreaElement
    const marks = `a${'\u0301'.repeat(40_000)}`
    fireEvent.change(box, { target: { value: marks } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(status()).toContain('more than one report can carry'))
    expect(sendReport).not.toHaveBeenCalled()
    expect(box.value).toBe(marks)
    const families = '👨‍👩‍👧‍👦'.repeat(2000)
    expect(families).toHaveLength(22_000)
    fireEvent.change(box, { target: { value: families } })
    await waitFor(() => expect(status()).toContain('What were you doing'))
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(sendReport).toHaveBeenCalledTimes(1))
    expect(sendReport.mock.calls[0]![0].message).toBe(families)
  })

  it('does not send empty words', async () => {
    render(<ReportDock />)
    await userEvent.click(screen.getByRole('button', { name: /Report/ }))
    await userEvent.type(screen.getByLabelText('What went wrong'), '   {enter}')
    expect(sendReport).not.toHaveBeenCalled()
  })
})
