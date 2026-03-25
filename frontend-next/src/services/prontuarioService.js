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

  async getEvolucoes(prontuarioId) {
    return await api.getEvolucoes(prontuarioId)
  },

  async getUltimaEvolucao(prontuarioId) {
    return await api.getUltimaEvolucao(prontuarioId)
  },

  async getEvolucaoById(prontuarioId, evolucaoId) {
    const list = await api.getEvolucoes(prontuarioId)
    return list.find((e) => e.id === evolucaoId) || null
  },

  async createEvolucao(prontuarioId, evolucao) {
    return await api.createEvolucao(prontuarioId, evolucao)
  },

  async updateEvolucao(prontuarioId, evolucaoId, evolucao) {
    return await api.updateEvolucao(prontuarioId, evolucaoId, evolucao)
  },

  async finalizarEvolucao(prontuarioId, evolucaoId) {
    return await api.finalizarEvolucao(prontuarioId, evolucaoId)
  },

  async deleteEvolucao(prontuarioId, evolucaoId) {
    return await api.deleteEvolucao(prontuarioId, evolucaoId)
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
