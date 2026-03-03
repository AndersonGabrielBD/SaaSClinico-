import * as api from '@/lib/api'

export const agendamentoService = {
  // Listar agendamentos
  async getAll(filters) {
    return api.getAgendamentos(filters)
  },

  // Buscar agendamento por ID
  async getById(id) {
    return api.getAgendamentoById(id)
  },

  // Criar agendamento
  async create(agendamento) {
    return api.createAgendamento(agendamento)
  },

  // Atualizar agendamento
  async update(id, agendamento) {
    return api.updateAgendamento(id, agendamento)
  },

  // Alterar status
  async updateStatus(id, status) {
    return api.updateAgendamento(id, { status })
  },

  // Confirmar agendamento
  async confirm(id) {
    return this.updateStatus(id, 'confirmada')
  },

  // Cancelar agendamento
  async cancel(id) {
    return api.deleteAgendamento(id)
  },

  // Marcar como faltou
  async markAsMissed(id) {
    return this.updateStatus(id, 'faltou')
  },

  // Concluir agendamento
  async complete(id) {
    return this.updateStatus(id, 'concluida')
  },

  // Agendamentos do dia
  async getToday() {
    const today = new Date().toISOString().split('T')[0]
    const result = await this.getAll({ data_agendamento: today })
    return result.data || result || []
  },

  // Próximos agendamentos
  async getUpcoming(limit = 10) {
    return api.getProximosAgendamentos(limit)
  }
}
