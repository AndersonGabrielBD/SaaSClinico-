// filepath: frontend-next/src/services/frequenciaService.js
import { api } from '../lib/api';

export const frequenciaService = {
  /**
   * Registra frequência de atendimento
   */
  async registrar(data) {
    return await api.post('/frequencia', data);
  },
  
  /**
   * Lista frequência de um paciente
   */
  async getByPacienteId(pacienteId, profissionalId = null) {
    const params = {};
    if (profissionalId) {
      params.profissional_id = profissionalId;
    }
    
    return await api.get(`/frequencia/paciente/${pacienteId}`, { params });
  },
  
  /**
   * Busca estatísticas de frequência de um paciente
   */
  async getEstatisticasPaciente(pacienteId, profissionalId = null) {
    const params = {};
    if (profissionalId) {
      params.profissional_id = profissionalId;
    }
    
    return await api.get(`/frequencia/paciente/${pacienteId}/estatisticas`, { params });
  },
  
  /**
   * Busca estatísticas agrupadas por profissional
   */
  async getEstatisticasPorProfissional(pacienteId) {
    return await api.get(`/frequencia/paciente/${pacienteId}/por-profissional`);
  },
  
  /**
   * Lista frequência de um profissional
   */
  async getByProfissionalId(profissionalId) {
    return await api.get(`/frequencia/profissional/${profissionalId}`);
  },
  
  /**
   * Atualiza registro de frequência
   */
  async update(id, data) {
    return await api.put(`/frequencia/${id}`, data);
  },
  
  /**
   * Deleta registro de frequência
   */
  async delete(id) {
    return await api.delete(`/frequencia/${id}`);
  },

  /**
   * Lista estatísticas de frequência de todos os pacientes
   * Admin/Recepcao: todos os pacientes
   * Profissionais: apenas seus pacientes vinculados
   */
  async getEstatisticasTodosPacientes() {
    return await api.get('/frequencia/todos-pacientes');
  },

  /**
   * Busca resumo mensal de consultas para cálculo de pagamento
   * @param {string} ano - Ex: "2026"
   * @param {string} mes - Ex: "02"
   */
  async getResumoMensal(ano, mes) {
    return await api.get(`/frequencia/resumo-mensal?ano=${ano}&mes=${mes}`);
  },

  /**
   * Exporta relatório de frequência mensal em PDF
   * @param {string} ano - Ex: "2026"
   * @param {string} mes - Ex: "02"
   */
  async exportPdf(ano, mes) {
    return await api.download(`/frequencia/export-pdf?ano=${ano}&mes=${mes}`);
  }
};
