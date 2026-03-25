import * as api from '@/lib/api'

export const modeloEvolucaoService = {
  async list() {
    return (await api.getModelosEvolucao()) || []
  },

  async create(payload) {
    return await api.createModeloEvolucao(payload)
  },

  async update(id, payload) {
    return await api.updateModeloEvolucao(id, payload)
  },

  async remove(id) {
    return await api.deleteModeloEvolucao(id)
  },
}
