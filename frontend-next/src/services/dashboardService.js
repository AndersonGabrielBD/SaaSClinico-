import * as api from '@/lib/api'

export const dashboardService = {
  // Obter estatísticas gerais
  async getStats(params = {}) {
    return api.getEstatisticas(params)
  },

  // Próximos agendamentos
  async getProximosAgendamentos(limite = 10) {
    return api.getProximosAgendamentos(limite)
  },

  // Faturamento por período (futuro)
  async getFaturamentoPorPeriodo(dataInicio, dataFim) {
    // TODO: Implementar endpoint no backend
    return 0
  },

  // Agendamentos por status (futuro)
  async getAgendamentosPorStatus(dataInicio, dataFim) {
    // TODO: Implementar endpoint no backend
    return {
      agendada: 0,
      confirmada: 0,
      concluida: 0,
      cancelada: 0,
      faltou: 0,
    }
  },

  // Top profissionais (futuro)
  async getTopProfissionais(limit = 5) {
    // TODO: Implementar endpoint no backend
    return []
  }
}
