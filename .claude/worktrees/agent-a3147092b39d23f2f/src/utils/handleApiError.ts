import { isAxiosError } from 'axios'

/**
 * Extrai a mensagem de erro do envelope padrão do backend:
 * { error: { code, message, details? } }
 *
 * Fallback para "Ocorreu um erro inesperado." em qualquer outro caso.
 * NUNCA expor stack trace ou detalhes técnicos ao usuário.
 */
export function handleApiError(error: unknown): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data?.error?.message
    if (typeof msg === 'string' && msg.length > 0) return msg
    if (error.response?.status === 429) return 'Muitas tentativas. Aguarde antes de tentar novamente.'
    if (error.response?.status === 403) return 'Você não tem permissão para realizar esta ação.'
    if (error.response?.status === 404) return 'Recurso não encontrado.'
    if (error.message === 'Network Error') return 'Não foi possível conectar ao servidor. Verifique sua conexão.'
  }
  return 'Ocorreu um erro inesperado.'
}
