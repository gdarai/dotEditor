import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NavigationDialog from './NavigationDialog.jsx'

describe('NavigationDialog', () => {
  const onMove = vi.fn()
  const onZoom = vi.fn()
  beforeEach(() => render(<NavigationDialog onMove={onMove} onZoom={onZoom} />))
  afterEach(() => { cleanup(); onMove.mockClear(); onZoom.mockClear() })

  it('requests movement in the chosen direction', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Move left' }))
    expect(onMove).toHaveBeenCalledWith('left')
  })

  it('requests a zoom change', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(onZoom).toHaveBeenCalledWith(1.25)
  })
})
