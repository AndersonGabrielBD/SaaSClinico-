/**
 * Utilitários de data para o timezone do Brasil (São Paulo)
 * Garante que todas as datas sejam calculadas corretamente independente do timezone do usuário
 */

const BRAZIL_TIMEZONE = 'America/Sao_Paulo'

/**
 * Retorna a data de hoje no Brasil no formato YYYY-MM-DD
 */
export function getTodayBrazil() {
  const now = new Date()
  // Formata para o timezone do Brasil
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(now) // Retorna no formato YYYY-MM-DD
}

/**
 * Retorna o mês atual no Brasil no formato YYYY-MM
 */
export function getCurrentMonthBrazil() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year').value
  const month = parts.find(p => p.type === 'month').value
  return `${year}-${month}`
}

/**
 * Retorna o primeiro dia do mês atual no Brasil no formato YYYY-MM-DD
 */
export function getFirstDayOfMonthBrazil() {
  return `${getCurrentMonthBrazil()}-01`
}

/**
 * Retorna datetime atual no Brasil no formato ISO
 */
export function getNowBrazil() {
  const now = new Date()
  return now.toLocaleString('sv-SE', { timeZone: BRAZIL_TIMEZONE }).replace(' ', 'T')
}

/**
 * Converte uma data para o formato do Brasil (DD/MM/YYYY)
 */
export function formatDateBrazil(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString + 'T12:00:00') // Adiciona hora para evitar problemas de timezone
  return date.toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIMEZONE })
}

/**
 * Retorna ano e mês atual como números
 */
export function getCurrentYearMonthBrazil() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  })
  const parts = formatter.formatToParts(now)
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value)
  }
}
