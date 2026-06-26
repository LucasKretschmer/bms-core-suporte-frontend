import { useCallback, useEffect, useState } from 'react'

type UseFullscreenReturn = {
  isFullscreen: boolean
  enter: () => Promise<void>
  exit: () => Promise<void>
  isSupported: boolean
}

/**
 * Wrapa Fullscreen API.
 * Trata ausência de suporte degradando para overlay CSS (isFullscreen via state).
 * Escuta fullscreenchange e keydown Escape para sair.
 */
export function useFullscreen(elementRef: React.RefObject<HTMLElement | null>): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isSupported =
    typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

  const exit = useCallback(async () => {
    if (isSupported && document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      setIsFullscreen(false)
    }
  }, [isSupported])

  const enter = useCallback(async () => {
    if (!elementRef.current) return
    if (isSupported) {
      await elementRef.current.requestFullscreen()
    } else {
      setIsFullscreen(true) // fallback: overlay CSS
    }
  }, [elementRef, isSupported])

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void exit()
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [exit])

  return { isFullscreen, enter, exit, isSupported }
}
