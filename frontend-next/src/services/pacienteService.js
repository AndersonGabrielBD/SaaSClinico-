import * as api from '@/lib/api'

export const pacienteService = {
  // Listar pacientes
  async getAll(filters) {
    return api.getPacientes(filters)
  },

  // Buscar paciente por ID
  async getById(id) {
    return api.getPacienteById(id)
  },

  // Criar paciente
  async create(paciente) {
    return api.createPaciente(paciente)
  },

  // Atualizar paciente
  async update(id, paciente) {
    return api.updatePaciente(id, paciente)
  },

  // Desativar paciente (soft delete)
  async deactivate(id) {
    return api.deletePaciente(id)
  },

  // Reativar paciente
  async reactivate(id) {
    return api.updatePaciente(id, { ativo: true })
  },

  // Buscar por CPF
  async getByCPF(cpf) {
    try {
      const data = await api.getPacientes({ search: cpf, ativo: true })
      return data.length > 0 ? data[0] : null
    } catch {
      return null
    }
  },

  // Buscar histórico de agendamentos do paciente
  async getAgendamentos(pacienteId) {
    try {
      const result = await api.getAgendamentos({ paciente_id: pacienteId })
      return result.data || result || []
    } catch {
      return []
    }
  },

  // Estatísticas do paciente
  async getStats(pacienteId) {
    const agendamentos = await this.getAgendamentos(pacienteId)

    return {
      total_consultas: agendamentos.length,
      consultas_realizadas: agendamentos.filter(a => a.status === 'concluida').length,
      consultas_canceladas: agendamentos.filter(a => a.status === 'cancelada').length,
      consultas_faltou: agendamentos.filter(a => a.status === 'faltou').length,
    }
  },

  // Relacionamento com Profissionais
  async getProfissionais(pacienteId) {
    return api.getPacienteProfissionais(pacienteId)
  },

  async addProfissionais(pacienteId, profissionalIds) {
    return api.addProfissionalToPaciente(pacienteId, profissionalIds)
  },

  async removeProfissional(pacienteId, profissionalId) {
    return api.removeProfissionalFromPaciente(pacienteId, profissionalId)
  },

  async syncProfissionais(pacienteId, profissionalIds) {
    return api.syncPacienteProfissionais(pacienteId, profissionalIds)
  }
}
