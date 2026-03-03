import * as api from '@/lib/api'

export const prontuarioService = {
  // ============== PRONTUÁRIOS ==============
  
  // Listar prontuários
  async getAll(filters) {
    return await api.getProntuarios(filters)
  },

  // Buscar prontuário por ID
  async getById(id) {
    return await api.getProntuarioById(id)
  },

  // Criar prontuário
  async create(prontuario) {
    try {
      return await api.createProntuario(prontuario)
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao criar prontuário:', error)
      throw error
    }
  },

  // Atualizar prontuário
  async update(id, prontuario) {
    try {
      return await api.updateProntuario(id, prontuario)
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao atualizar prontuário:', error)
      throw error
    }
  },

  // Deletar prontuário
  async delete(id) {
    return api.deleteProntuario(id)
  },

  // ============== EVOLUÇÕES ==============
  // TODO: Implementar endpoints de evoluções no backend

  // Listar evoluções de um prontuário
  async getEvolucoes(prontuarioId) {
    // TODO: Implementar endpoint no backend
    return []
  },

  // Buscar evolução por ID
  async getEvolucaoById(prontuarioId, evolucaoId) {
    // TODO: Implementar endpoint no backend
    return null
  },

  // Criar evolução
  async createEvolucao(prontuarioId, evolucao) {
    // TODO: Implementar endpoint no backend
    return null
  },

  // Atualizar evolução (somente se não estiver imutável)
  async updateEvolucao(prontuarioId, evolucaoId, evolucao) {
    // TODO: Implementar endpoint no backend
    return null
  },

  // Finalizar evolução (tornar imutável)
  async finalizarEvolucao(prontuarioId, evolucaoId) {
    // TODO: Implementar endpoint no backend
    return null
  },

  // Deletar evolução (somente se não estiver imutável)
  async deleteEvolucao(prontuarioId, evolucaoId) {
    // TODO: Implementar endpoint no backend
  },

  // ============== ANEXOS ==============
  // TODO: Implementar endpoints de anexos no backend

  // Upload de arquivo
  async uploadFile(file, prontuarioId, evolucaoId) {
    // TODO: Implementar endpoint no backend
    return null
  },

  // Listar anexos
  async getAnexos(prontuarioId, evolucaoId) {
    // TODO: Implementar endpoint no backend
    return []
  },

  // Deletar anexo
  async deleteAnexo(prontuarioId, anexoId) {
    // TODO: Implementar endpoint no backend
  }
}
