export function clampPan(position, graphSize, screenSize, zoom) {
  const limit = (graphSize * zoom) / 2 + screenSize
  return Math.max(-limit, Math.min(limit, position))
}

export function moveViewport(viewport, dimensions, direction) {
  const step = (direction === 'left' || direction === 'right' ? dimensions.width : dimensions.height) / 4
  const horizontal = direction === 'left' ? step : direction === 'right' ? -step : 0
  const vertical = direction === 'up' ? step : direction === 'down' ? -step : 0
  return {
    ...viewport,
    x: clampPan(viewport.x + horizontal, dimensions.graphWidth, dimensions.width, viewport.zoom),
    y: clampPan(viewport.y + vertical, dimensions.graphHeight, dimensions.height, viewport.zoom),
  }
}
