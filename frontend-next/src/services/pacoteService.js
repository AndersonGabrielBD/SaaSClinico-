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
  // PACOTE ATIVO POR PACIENTE + PROFISSIONAL
  // ==========================================================================

  // Busca o pacote pago e ativo de um paciente para um profissional específico,
  // retornando os itens com sessoes_utilizadas e sessoes_restantes calculados
  // pela RPC get_pacote_ativo_por_paciente_profissional.
  async getPacoteAtivoByPacienteEProfissional(paciente_id, profissional_id) {
    try {
      return await api.get('/pacotes/ativo-por-profissional', {
        params: { paciente_id, profissional_id },
      });
    } catch {
      return null;
    }
  },

  // ==========================================================================
  // ESTATÍSTICAS
  // ==========================================================================

  async getEstatisticas() {
    return await api.get('/pacotes/estatisticas');
  },
};
