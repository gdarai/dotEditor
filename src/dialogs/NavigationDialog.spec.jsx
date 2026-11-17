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

  it('requests movement on arrow key presses', async () => {
    await userEvent.keyboard('{ArrowUp}')
    expect(onMove).toHaveBeenCalledWith('up')
    await userEvent.keyboard('{ArrowRight}')
    expect(onMove).toHaveBeenCalledWith('right')
  })

  it('requests zoom on PageUp/PageDown presses', async () => {
    await userEvent.keyboard('{PageUp}')
    expect(onZoom).toHaveBeenCalledWith(1.25)
    await userEvent.keyboard('{PageDown}')
    expect(onZoom).toHaveBeenCalledWith(0.8)
  })
})
