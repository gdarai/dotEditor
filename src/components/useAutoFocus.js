import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

export default function useAutoFocus(deps = []) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.querySelector(FOCUSABLE_SELECTOR)?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
