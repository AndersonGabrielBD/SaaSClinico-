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
   * Resumo no período (data_inicio / data_fim) ou mês legado (ano/mes).
   * @param {{ dataInicio: string, dataFim: string, somenteFaltas?: boolean }} range
   * @param {{ ano: string, mes: string, somenteFaltas?: boolean }} month — alternativa ao range
   */
  async getResumoMensal(params = {}) {
    const sp = new URLSearchParams();
    if (params.dataInicio && params.dataFim) {
      sp.set('data_inicio', params.dataInicio);
      sp.set('data_fim', params.dataFim);
    } else if (params.ano && params.mes) {
      sp.set('ano', params.ano);
      sp.set('mes', params.mes);
    } else {
      throw new Error('Informe dataInicio/dataFim ou ano/mes');
    }
    if (params.somenteFaltas) sp.set('somente_faltas', 'true');
    return await api.get(`/frequencia/resumo-mensal?${sp}`);
  },

  /**
   * Exporta PDF com os mesmos filtros de getResumoMensal
   */
  async exportPdf(params = {}) {
    const sp = new URLSearchParams();
    if (params.dataInicio && params.dataFim) {
      sp.set('data_inicio', params.dataInicio);
      sp.set('data_fim', params.dataFim);
    } else if (params.ano && params.mes) {
      sp.set('ano', params.ano);
      sp.set('mes', params.mes);
    } else {
      throw new Error('Informe dataInicio/dataFim ou ano/mes');
    }
    if (params.somenteFaltas) sp.set('somente_faltas', 'true');
    return await api.download(`/frequencia/export-pdf?${sp}`);
  }
};
