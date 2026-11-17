import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import ExportPage from './ExportPage.jsx'

describe('ExportPage', () => {
  const writeText = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    writeText.mockReset()
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('copies and displays the raw graph', async () => {
    writeText.mockResolvedValue()
    render(<ExportPage dot="digraph { a -> b }" onBack={vi.fn()} />)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('digraph { a -> b }'))
    expect(screen.getByText('digraph { a -> b }')).toBeInTheDocument()
  })

  it('reports clipboard failures', async () => {
    writeText.mockRejectedValue(new Error('permission denied'))
    render(<ExportPage dot="graph {}" onBack={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
  })

  it('uses the red Back button', () => {
    writeText.mockResolvedValue()
    render(<ExportPage dot="graph {}" onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('button-back')
  })
})
