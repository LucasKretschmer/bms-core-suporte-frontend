/**
 * tokenStore — armazenamento seguro do JWT em memória.
 *
 * DECISÃO DE ARQUITETURA (ver arquitetura.md §4.3):
 * O token JWT vive APENAS em memória (variável de módulo singleton).
 * NUNCA em localStorage, sessionStorage ou cookie acessível por JS.
 *
 * Consequência aceita: ao dar F5/refresh da aba, o token se perde e o usuário
 * é redirecionado para /login?redirect=<rota-atual>.
 *
 * Trade-off documentado para o Manager:
 * - Opção atual (Fase 0): re-login no refresh. Mais simples e seguro.
 * - Opção futura: cookie httpOnly + endpoint /auth/refresh no backend.
 *   Isso exige mudança no backend e está fora do escopo desta rodada.
 *
 * A reordenação de colunas da DataTable e o estado colapsado do Sidebar
 * SÃO persisitidos em localStorage — são preferências de layout, não dados
 * sensíveis, e não há risco de XSS relacionado ao token.
 */

let _token: string | null = null
let _expiresAt: number | null = null // timestamp Unix em milissegundos

export const tokenStore = {
  /**
   * Armazena o token e o timestamp de expiração em memória.
   * @param token - JWT recebido do backend
   * @param expiresAt - ISO string do momento de expiração (ex: "2024-03-15T11:00:00Z")
   */
  set(token: string, expiresAt: string): void {
    _token = token
    _expiresAt = new Date(expiresAt).getTime()
  },

  /**
   * Retorna o token se ainda válido; null se expirado ou não presente.
   */
  get(): string | null {
    if (_token === null || _expiresAt === null) return null
    if (Date.now() >= _expiresAt) {
      // Token expirado — limpa automaticamente
      _token = null
      _expiresAt = null
      return null
    }
    return _token
  },

  /**
   * Remove o token da memória (logout ou 401).
   */
  clear(): void {
    _token = null
    _expiresAt = null
  },

  /**
   * Verifica se há um token válido e não expirado em memória.
   */
  isValid(): boolean {
    return tokenStore.get() !== null
  },
}
