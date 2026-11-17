import { describe, expect, it } from 'vitest'
import { clampPan, moveViewport } from './NavigationDialog.utils.js'

describe('graph panning', () => {
  it('permits half a screen beyond the ordinary edge limit', () => {
    const graph = 600
    const screen = 400
    const edgeLimit = (graph + screen) / 2
    expect(clampPan(edgeLimit + screen / 2, graph, screen, 1)).toBe(edgeLimit + screen / 2)
    expect(clampPan(99999, graph, screen, 1)).toBe(graph / 2 + screen)
  })

  it('moves in four directions with a viewport-relative step', () => {
    const dimensions = { width: 400, height: 200, graphWidth: 600, graphHeight: 100 }
    expect(moveViewport({ x: 0, y: 0, zoom: 1 }, dimensions, 'left').x).toBe(100)
    expect(moveViewport({ x: 0, y: 0, zoom: 1 }, dimensions, 'down').y).toBe(-50)
  })
})
