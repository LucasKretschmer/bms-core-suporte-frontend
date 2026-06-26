/**
 * tokenStore — armazenamento seguro do access token (JWT) em memória.
 *
 * DECISÃO DE ARQUITETURA:
 * O access token vive APENAS em memória (variável de módulo singleton).
 * NUNCA em localStorage, sessionStorage ou cookie acessível por JS.
 *
 * Persistência de sessão (F5/refresh da aba): o access token NÃO é persistido.
 * Ao recarregar, ele é reidratado via `POST /api/v1/auth/refresh` (ver
 * `utils/ensureSession.ts`), que usa o cookie httpOnly `suporte_refresh`
 * (Path=/api/v1/auth) enviado automaticamente pelo browser. O refresh token
 * vive SÓ nesse cookie httpOnly — inacessível ao JS, imune a XSS.
 *
 * Expiração do access em uso: tratada reativamente pelo interceptor 401 do
 * Axios (refresh-once → retry), nunca por auto-logout local.
 *
 * A reordenação de colunas da DataTable e o estado colapsado do Sidebar SÃO
 * persistidos em localStorage — são preferências de layout, não dados
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
