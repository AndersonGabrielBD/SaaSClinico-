import * as api from '@/lib/api'

export const profissionalService = {
  // Pacientes do profissional logado
  async getMyPacientes(filters) {
    return api.getMyPacientes(filters)
  },

  // Pacientes de um profissional específico
  async getProfissionalPacientes(profissionalId, filters) {
    return api.getProfissionalPacientes(profissionalId, filters)
  },

  // Prontuários do profissional logado
  async getMyProntuarios(filters) {
    return api.getMyProntuarios(filters)
  },

  // Prontuários de um profissional específico
  async getProfissionalProntuarios(profissionalId, filters) {
    return api.getProfissionalProntuarios(profissionalId, filters)
  },

  // Estatísticas do profissional logado
  async getMyEstatisticas() {
    return api.getMyEstatisticas()
  },

  // Buscar paciente específico entre os do profissional
  async getMyPacienteById(pacienteId) {
    try {
      const pacientes = await this.getMyPacientes()
      return pacientes.find(p => p.id === pacienteId) || null
    } catch {
      return null
    }
  },

  // Buscar prontuário específico entre os do profissional
  async getMyProntuarioById(prontuarioId) {
    try {
      const prontuarios = await this.getMyProntuarios()
      return prontuarios.find(p => p.id === prontuarioId) || null
    } catch {
      return null
    }
  },

  // Buscar prontuários de um paciente específico
  async getMyProntuariosByPaciente(pacienteId) {
    return this.getMyProntuarios({ paciente_id: pacienteId })
  }
}
