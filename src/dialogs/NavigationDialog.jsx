import { useEffect } from 'react'

const MOVE_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

export default function NavigationDialog({ onMove, onZoom }) {
  useEffect(() => {
    const onKeyDown = event => {
      const direction = MOVE_KEYS[event.key]
      if (direction) {
        event.preventDefault()
        onMove(direction)
        return
      }
      if (event.key === 'PageUp') {
        event.preventDefault()
        onZoom(1.25)
      } else if (event.key === 'PageDown') {
        event.preventDefault()
        onZoom(0.8)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onMove, onZoom])

  return (
    <nav className="navigation-dialog" aria-label="Graph navigation">
      <button type="button" aria-label="Zoom in" onClick={() => onZoom(1.25)}>+</button>
      <button type="button" aria-label="Move up" onClick={() => onMove('up')}>↑</button>
      <button type="button" aria-label="Zoom out" onClick={() => onZoom(0.8)}>−</button>
      <button type="button" aria-label="Move left" onClick={() => onMove('left')}>←</button>
      <button type="button" aria-label="Move down" onClick={() => onMove('down')}>↓</button>
      <button type="button" aria-label="Move right" onClick={() => onMove('right')}>→</button>
    </nav>
  )
}
