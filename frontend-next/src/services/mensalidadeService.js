// filepath: frontend-next/src/services/mensalidadeService.js
import { api } from '../lib/api';

export const mensalidadeService = {
  // ============================================================================
  // MENSALIDADES
  // ============================================================================
  
  /**
   * Lista mensalidades da clínica
   */
  async getAll(ativo = null) {
    const params = {};
    if (ativo !== null) {
      params.ativo = ativo;
    }
    
    return await api.get('/mensalidades', { params });
  },
  
  /**
   * Busca mensalidade por ID
   */
  async getById(id) {
    return await api.get(`/mensalidades/${id}`);
  },
  
  /**
   * Busca mensalidade de um paciente específico
   */
  async getByPacienteId(pacienteId) {
    return await api.get(`/mensalidades/paciente/${pacienteId}`);
  },
  
  /**
   * Cria nova mensalidade
   */
  async create(data) {
    return await api.post('/mensalidades', data);
  },
  
  /**
   * Atualiza mensalidade existente
   */
  async update(id, data) {
    return await api.put(`/mensalidades/${id}`, data);
  },
  
  /**
   * Desativa mensalidade
   */
  async delete(id) {
    return await api.delete(`/mensalidades/${id}`);
  },
  
  /**
   * Gera pagamentos do mês atual para todas as mensalidades
   */
  async gerarPagamentosMesAtual() {
    return await api.post('/mensalidades/gerar-mes-atual', {});
  },
  
  // ============================================================================
  // PAGAMENTOS
  // ============================================================================
  
  /**
   * Lista pagamentos com filtros opcionais
   */
  async getPagamentos(filters = {}) {
    return await api.get('/mensalidades/pagamentos', { params: filters });
  },
  
  /**
   * Busca pagamento por ID
   */
  async getPagamentoById(id) {
    return await api.get(`/mensalidades/pagamentos/${id}`);
  },
  
  /**
   * Marca pagamento como pago
   */
  async marcarPago(id, data) {
    return await api.put(`/mensalidades/pagamentos/${id}/marcar-pago`, data);
  },

  /**
   * Marca pagamento como pendente
   */
  async marcarPendente(id) {
    return await api.put(`/mensalidades/pagamentos/${id}/marcar-pendente`, {});
  },
  
  /**
   * Altera data de vencimento de um pagamento
   */
  async alterarVencimento(id, novaData) {
    return await api.put(`/mensalidades/pagamentos/${id}/alterar-vencimento`, {
      nova_data_vencimento: novaData
    });
  },
  
  /**
   * Busca pagamentos com vencimento próximo (alertas)
   */
  async getProximosVencimentos(dias = 3) {
    return await api.get('/mensalidades/proximos-vencimentos', {
      params: { dias }
    });
  },
  
  /**
   * Busca estatísticas do sistema de mensalidades
   */
  async getEstatisticas() {
    return await api.get('/mensalidades/estatisticas');
  }
};
