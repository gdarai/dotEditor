import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ColorPicker from './ColorPicker.jsx'

describe('ColorPicker', () => {
  const onChange = vi.fn()
  beforeEach(() => { localStorage.clear(); render(<ColorPicker label="Fill" value="#112233" onChange={onChange} />) })
  afterEach(() => { cleanup(); onChange.mockClear() })

  it('allows clearing an optional color', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('offers a color input for selection', () => {
    expect(screen.getByLabelText('Fill')).toHaveValue('#112233')
  })
})
