import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NotchNav, type NotchItemData } from '../components/ui/adaptive-notch-navigation-bar'
import { notchActiveId } from '../components/workspace/shell'

/**
 * The notch nav as the header (owner, 2026-09-02), and Devin's three findings
 * on making it so: Upload must start fresh, a page the nav does not list
 * must select nothing, and the skip link must sit above the header.
 */

const Icon = ({ className }: { className?: string }) => <svg className={className} aria-hidden />
const items: NotchItemData[] = [
  { id: 'upload', label: 'Upload', icon: Icon, href: '/start', fullNavigation: true },
  { id: 'library', label: 'Library', icon: Icon, href: '/clips' },
]

afterEach(cleanup)

describe('the notch nav', () => {
  it('draws no bar at all when it has no destinations — the library is hidden for now, and one entry is nothing to switch between', () => {
    render(<NotchNav items={[]} activeId={null}><div>page</div></NotchNav>)
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.getByText('page')).toBeTruthy()
  })

  it('still draws the bar for actions it was given, even with no destinations', () => {
    // Devin's finding on #78: the guard for an empty bar also hid the
    // rightContent a caller supplied.
    render(<NotchNav items={[]} activeId={null} rightContent={<button type="button">Act</button>}><div /></NotchNav>)
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Act' })).toBeTruthy()
  })

  it('marks only the page being shown as current', () => {
    render(<NotchNav items={items} activeId="library"><div /></NotchNav>)
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Upload' }).getAttribute('aria-current')).toBeNull()
  })

  it('marks nothing current on a page it does not list', () => {
    render(<NotchNav items={items} activeId={null}><div /></NotchNav>)
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0)
  })

  it('makes Upload a full navigation, so the start screen is fresh every time', () => {
    render(<NotchNav items={items} activeId={null}><div /></NotchNav>)
    const upload = screen.getByRole('link', { name: 'Upload' })
    expect(upload.getAttribute('href')).toBe('/start')
    expect(upload.getAttribute('data-navigation')).toBe('full')
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('data-navigation')).toBeNull()
  })
})

describe('which notch item a page belongs to', () => {
  it('names Upload and Library for their pages, and nothing for the hidden ones', () => {
    expect(notchActiveId('start')).toBe('upload')
    expect(notchActiveId('home')).toBe('upload')
    expect(notchActiveId('clips')).toBe('library')
    expect(notchActiveId('publishing')).toBeNull()
    expect(notchActiveId('workspaces')).toBeNull()
    expect(notchActiveId('join')).toBeNull()
  })
})
