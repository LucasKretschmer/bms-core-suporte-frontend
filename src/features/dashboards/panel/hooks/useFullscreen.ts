import { useCallback, useEffect, useState } from 'react'

type UseFullscreenReturn = {
  isFullscreen: boolean
  /** Entra em fullscreen no documento inteiro (espelha o protótipo). Nunca lança. */
  enter: () => Promise<void>
  /** Sai do fullscreen se ativo. Nunca lança. */
  exit: () => Promise<void>
  isSupported: boolean
}

/**
 * Wrapa a Fullscreen API no DOCUMENTO inteiro (`document.documentElement`),
 * espelhando `document.documentElement.requestFullscreen()` do protótipo.
 *
 * O painel NÃO depende do sucesso do fullscreen: `requestFullscreen` pode ser
 * negado (sem gesto do usuário / política do browser). Por isso `enter`/`exit`
 * engolem a rejeição (`.catch`) e o overlay `fixed inset-0` já esconde o chrome.
 * A fonte de verdade de "estou no painel" é o `isActive` do PanelMode, não este
 * `isFullscreen` (que serve só para refletir o estado real do browser).
 */
export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isSupported =
    typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

  const enter = useCallback(async () => {
    if (!isSupported) return
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // Fullscreen negado/falhou — o overlay segue cobrindo a tela.
    }
  }, [isSupported])

  const exit = useCallback(async () => {
    if (typeof document === 'undefined' || !document.fullscreenElement) return
    try {
      await document.exitFullscreen()
    } catch {
      // Sem fullscreen ativo / falha ao sair — ignorado.
    }
  }, [])

  // Reflete o estado real do fullscreen do browser.
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  return { isFullscreen, enter, exit, isSupported }
}
