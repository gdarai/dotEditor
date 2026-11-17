import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfigDialog from './ConfigDialog.jsx'

vi.mock('../api.js', () => ({ saveGraph: vi.fn(), loadGraph: vi.fn() }))
vi.mock('../graph/dot.js', () => ({ inspectGraph: vi.fn() }))

describe('ConfigDialog', () => {
  const onCreate = vi.fn()
  const onChange = vi.fn()
  const onLoad = vi.fn()
  const onClose = vi.fn()
  const onExport = vi.fn()
  const props = { dot: '', graphName: 'G', apiUrl: '', apiKey: '', layout: 'auto', onChange, onCreate, onLoad, onExport, onClose }
  let dialog
  beforeEach(() => { dialog = render(<ConfigDialog {...props} />) })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('requires creating or loading a graph on first visit', () => {
    expect(screen.getByRole('button', { name: 'New graph' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('keeps first-visit actions in the bottom group', () => {
    expect(within(screen.getByRole('group', { name: 'Dialog actions' })).getAllByRole('button').map(button => button.textContent))
      .toEqual(['New graph', 'Save', 'Load', 'Export'])
  })

  it('offers creation of an empty graph', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New graph' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('reports layout preference changes', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Display'), 'mobile')
    expect(onChange).toHaveBeenCalledWith('layout', 'mobile')
  })

  describe('with a graph', () => {
    beforeEach(() => dialog.rerender(<ConfigDialog {...props} dot="digraph {}" />))

    it('places Back after the other actions in the bottom group', () => {
      expect(within(screen.getByRole('group', { name: 'Dialog actions' })).getAllByRole('button').map(button => button.textContent))
        .toEqual(['Save', 'Load', 'Export', 'Back'])
    })

    it('closes via the red Back button', async () => {
      const back = screen.getByRole('button', { name: 'Back' })
      expect(back).toHaveClass('button-back')
      await userEvent.click(back)
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
