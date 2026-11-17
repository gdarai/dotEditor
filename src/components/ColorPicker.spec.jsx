import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readColors, rememberColor } from '../storage.js'
import ColorPicker from './ColorPicker.jsx'

function ControlledPicker({ onChange }) {
  const [value, setValue] = useState('#112233')
  return <ColorPicker label="Fill" value={value} onChange={color => { setValue(color); onChange(color) }} />
}

describe('ColorPicker', () => {
  const onChange = vi.fn()
  beforeEach(() => { localStorage.clear(); render(<ControlledPicker onChange={onChange} />) })
  afterEach(() => { cleanup(); onChange.mockClear() })

  it('allows clearing an optional color', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('keeps the native color input and memory tray inside the popup', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    const popup = screen.getByRole('dialog', { name: 'Fill color picker' })
    expect(within(popup).getByLabelText('Fill picker')).toHaveValue('#112233')
    expect(within(popup).getByLabelText('Fill recent colors')).toBeInTheDocument()
  })

  it('remembers only the final color when the popup closes', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    fireEvent.change(screen.getByLabelText('Fill picker'), { target: { value: '#445566' } })
    fireEvent.change(screen.getByLabelText('Fill picker'), { target: { value: '#778899' } })
    expect(readColors()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(readColors()).toEqual(['#778899'])
  })

  it('remembers the final color when Escape closes the popup', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Fill color picker' })).not.toBeInTheDocument()
    expect(readColors()).toEqual(['#112233'])
  })

  it('remembers the final color when clicking outside the popup', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    await userEvent.click(document.body)
    expect(readColors()).toEqual(['#112233'])
  })

  it('does not move a saved color when selected again', async () => {
    rememberColor('#112233')
    rememberColor('#445566')
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Fill color picker' })).getByRole('button', { name: 'Use #112233' }))
    expect(readColors()).toEqual(['#445566', '#112233'])
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(readColors()).toEqual(['#445566', '#112233'])
  })

  it('does not remember an empty color on close', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Choose Fill' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(readColors()).toEqual([])
  })
})
