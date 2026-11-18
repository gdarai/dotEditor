import { useEffect } from 'react'

function isTyping(target) {
  return target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export default function useShortcuts(shortcuts, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    function onKeyDown(event) {
      if (isTyping(event.target)) return
      const match = shortcuts.find(({ key, alt = false }) => key.toLowerCase() === event.key.toLowerCase() && event.altKey === alt)
      if (match) {
        event.preventDefault()
        match.handler()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, enabled])
}
