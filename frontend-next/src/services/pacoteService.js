import { api } from '../lib/api';

export const pacoteService = {
  // ==========================================================================
  // PROFISSIONAIS DISPONÍVEIS
  // ==========================================================================

  async getProfissionais() {
    return await api.get('/pacotes/profissionais');
  },

  // ==========================================================================
  // TIPOS DE PROFISSIONAL
  // ==========================================================================

  async getTipos(ativo = null) {
    const params = {};
    if (ativo !== null) params.ativo = ativo;
    return await api.get('/pacotes/tipos-profissional', { params });
  },

  async getTipoById(id) {
    return await api.get(`/pacotes/tipos-profissional/${id}`);
  },

  async createTipo(data) {
    return await api.post('/pacotes/tipos-profissional', data);
  },

  async updateTipo(id, data) {
    return await api.put(`/pacotes/tipos-profissional/${id}`, data);
  },

  async deleteTipo(id) {
    return await api.delete(`/pacotes/tipos-profissional/${id}`);
  },

  // ==========================================================================
  // PACOTES
  // ==========================================================================

  async getAll(ativo = null) {
    const params = {};
    if (ativo !== null) params.ativo = ativo;
    return await api.get('/pacotes', { params });
  },

  async getById(id) {
    return await api.get(`/pacotes/${id}`);
  },

  async create(data) {
    return await api.post('/pacotes', data);
  },

  async update(id, data) {
    return await api.put(`/pacotes/${id}`, data);
  },

  async delete(id) {
    return await api.delete(`/pacotes/${id}`);
  },

  async ativar(id) {
    return await api.put(`/pacotes/${id}/ativar`, {});
  },

  // ==========================================================================
  // PAGAMENTO DO PACOTE (inline)
  // ==========================================================================

  async marcarPago(id, data) {
    return await api.put(`/pacotes/${id}/marcar-pago`, data);
  },

  async marcarPendente(id) {
    return await api.put(`/pacotes/${id}/marcar-pendente`, {});
  },

  // ==========================================================================
  // ESTATÍSTICAS
  // ==========================================================================

  async getEstatisticas() {
    return await api.get('/pacotes/estatisticas');
  },
};
