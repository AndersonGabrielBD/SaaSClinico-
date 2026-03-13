// filepath: frontend-next/src/services/pacoteService.js
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
  // PACOTES POR PACIENTE
  // ==========================================================================

  async getAll(ativo = null) {
    const params = {};
    if (ativo !== null) params.ativo = ativo;
    return await api.get('/pacotes', { params });
  },

  async getById(id) {
    return await api.get(`/pacotes/${id}`);
  },

  async getByPacienteId(pacienteId) {
    return await api.get(`/pacotes/paciente/${pacienteId}`);
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

  // ==========================================================================
  // PAGAMENTOS DE PACOTES
  // ==========================================================================

  async gerarPagamentosMesAtual() {
    return await api.post('/pacotes/gerar-mes-atual', {});
  },

  async getPagamentos(filters = {}) {
    return await api.get('/pacotes/pagamentos', { params: filters });
  },

  async getPagamentoById(id) {
    return await api.get(`/pacotes/pagamentos/${id}`);
  },

  async marcarPago(id, data) {
    return await api.put(`/pacotes/pagamentos/${id}/marcar-pago`, data);
  },

  async marcarPendente(id) {
    return await api.put(`/pacotes/pagamentos/${id}/marcar-pendente`, {});
  },

  async alterarVencimento(id, novaData) {
    return await api.put(`/pacotes/pagamentos/${id}/alterar-vencimento`, {
      nova_data_vencimento: novaData,
    });
  },

  async getEstatisticas() {
    return await api.get('/pacotes/estatisticas');
  },
};
