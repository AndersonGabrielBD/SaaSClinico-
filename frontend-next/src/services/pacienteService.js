import * as api from '@/lib/api'

/**
 * Normalises the paginated response from the API.
 * The backend returns { data: [], pagination: {} } — this helper extracts the
 * array so callers that expect a plain array keep working. Pass
 * `rawPagination: true` in options to get the full envelope.
 */
function extractList(response, rawPagination = false) {
  if (rawPagination) return response
  if (response && Array.isArray(response.data)) return response.data
  if (Array.isArray(response)) return response
  return []
}

export const pacienteService = {
  async getAll(filters, { paginated = false } = {}) {
    const response = await api.getPacientes(filters)
    return extractList(response, paginated)
  },

  async getById(id) {
    return api.getPacienteById(id)
  },

  async create(paciente) {
    return api.createPaciente(paciente)
  },

  async update(id, paciente) {
    return api.updatePaciente(id, paciente)
  },

  async deactivate(id) {
    return api.deletePaciente(id)
  },

  async reactivate(id) {
    return api.updatePaciente(id, { ativo: true })
  },

  async getByCPF(cpf) {
    try {
      const data = await this.getAll({ search: cpf, ativo: true })
      return data.length > 0 ? data[0] : null
    } catch {
      return null
    }
  },

  async getAgendamentos(pacienteId) {
    try {
      const result = await api.getAgendamentos({ paciente_id: pacienteId })
      return result.data || result || []
    } catch {
      return []
    }
  },

  async getStats(pacienteId) {
    const agendamentos = await this.getAgendamentos(pacienteId)
    return {
      total_consultas: agendamentos.length,
      consultas_realizadas: agendamentos.filter(a => a.status === 'concluida').length,
      consultas_canceladas: agendamentos.filter(a => a.status === 'cancelada').length,
      consultas_faltou: agendamentos.filter(a => a.status === 'faltou').length,
    }
  },

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
  },
}
