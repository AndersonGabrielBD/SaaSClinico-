import * as api from '@/lib/api'
import { getTodayBrazil } from '@/lib/dateUtils'

// Gera uma lista de datas a partir de uma data inicial, frequência e limite
function gerarDatasRecorrentes({ dataInicio, frequencia, totalOcorrencias, dataFim }) {
  const datas = []
  const [ano, mes, dia] = dataInicio.split('-').map(Number)
  let atual = new Date(ano, mes - 1, dia)
  const limite = dataFim ? new Date(dataFim) : null

  for (let i = 0; i < (totalOcorrencias || 52); i++) {
    const dataStr = atual.toISOString().split('T')[0]
    if (limite && atual > limite) break
    datas.push(dataStr)

    if (frequencia === 'semanal') {
      atual = new Date(atual)
      atual.setDate(atual.getDate() + 7)
    } else if (frequencia === 'quinzenal') {
      atual = new Date(atual)
      atual.setDate(atual.getDate() + 14)
    } else if (frequencia === 'mensal') {
      atual = new Date(atual)
      atual.setMonth(atual.getMonth() + 1)
    } else {
      break
    }

    if (datas.length >= 52) break
  }

  return datas
}

export const agendamentoService = {
  // Listar agendamentos
  async getAll(filters) {
    return api.getAgendamentos(filters)
  },

  // Buscar agendamento por ID
  async getById(id) {
    return api.getAgendamentoById(id)
  },

  // Criar agendamento simples
  async create(agendamento) {
    return api.createAgendamento(agendamento)
  },

  // Criar agendamentos recorrentes em batch
  // recorrenciaConfig: { frequencia, totalOcorrencias, dataFim }
  async createRecorrente(agendamentoBase, recorrenciaConfig) {
    const recorrenciaId = crypto.randomUUID()
    const datas = gerarDatasRecorrentes({
      dataInicio: agendamentoBase.data_agendamento,
      frequencia: recorrenciaConfig.frequencia,
      totalOcorrencias: recorrenciaConfig.totalOcorrencias,
      dataFim: recorrenciaConfig.dataFim,
    })

    const resultados = []
    const erros = []

    for (const data of datas) {
      try {
        const result = await api.createAgendamento({
          ...agendamentoBase,
          data_agendamento: data,
          recorrencia_id: recorrenciaId,
          recorrencia_tipo: recorrenciaConfig.frequencia,
          pacote_item_id: agendamentoBase.pacote_item_id || null,
        })
        resultados.push(result)
      } catch (err) {
        erros.push({ data, erro: err.message })
      }
    }

    return { criados: resultados, erros, recorrenciaId }
  },

  // Atualizar agendamento
  async update(id, agendamento) {
    return api.updateAgendamento(id, agendamento)
  },

  // Alterar status
  async updateStatus(id, status, extra = {}) {
    return api.updateAgendamento(id, { status, ...extra })
  },

  // Confirmar agendamento
  async confirm(id) {
    return this.updateStatus(id, 'confirmada')
  },

  // Cancelar agendamento (soft-delete via DELETE que o backend converte em status=cancelada)
  async cancel(id, motivo) {
    if (motivo) {
      return api.updateAgendamento(id, { status: 'cancelada', motivo_cancelamento: motivo })
    }
    return api.deleteAgendamento(id)
  },

  // Iniciar atendimento (valida horário no frontend antes de chamar)
  async startService(id) {
    return this.updateStatus(id, 'em_atendimento')
  },

  // Marcar como faltou
  async markAsMissed(id) {
    return this.updateStatus(id, 'faltou')
  },

  // Concluir agendamento
  async complete(id) {
    return this.updateStatus(id, 'concluida')
  },

  // Cancelar todos os agendamentos de uma série recorrente
  // scope: 'all' | 'from_date'
  async cancelByRecorrenciaId(recorrenciaId, fromDate, motivo) {
    return api.cancelarRecorrencia({ recorrencia_id: recorrenciaId, from_date: fromDate || undefined, motivo: motivo || undefined })
  },

  // Agendamentos do dia
  async getToday() {
    const today = getTodayBrazil()
    const result = await this.getAll({ data_agendamento: today })
    return result.data || result || []
  },

  // Próximos agendamentos
  async getUpcoming(limit = 10) {
    return api.getProximosAgendamentos(limit)
  }
}
