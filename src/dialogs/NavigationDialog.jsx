export default function NavigationDialog({ onMove, onZoom }) {
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
