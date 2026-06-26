/**
 * Constantes do detalhe do ticket.
 *
 * INVOICY: categoria HubSpot cujas horas vão para "análise" (fora do consumo do
 * plano). Isolada aqui numa única constante (R10) — não espalhar a string.
 * Se o backend passar a expor um flag dedicado no DTO, preferir o flag.
 */
export const INVOICY_CATEGORY = 'Problema - Invoicy'
