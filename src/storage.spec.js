import { beforeEach, describe, expect, it } from 'vitest'
import { keys, readColors, readSetting, rememberColor, writeSetting } from './storage.js'

describe('prefixed storage', () => {
  beforeEach(() => localStorage.clear())

  it('stores the graph in its own namespace', () => {
    writeSetting('graph', 'digraph {}')
    expect(localStorage.getItem(keys.graph)).toBe('digraph {}')
    expect(readSetting('graph')).toBe('digraph {}')
  })

  it('keeps eight recent unique colors', () => {
    for (let i = 0; i < 10; i++) rememberColor(`#00000${i}`)
    rememberColor('#000005')
    expect(readColors()).toHaveLength(8)
    expect(readColors()[0]).toBe('#000005')
  })
})
