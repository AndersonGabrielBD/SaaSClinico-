export interface Agendamento {
  id: string
  paciente_id: string
  profissional_id: string
  sala_id?: string
  data_agendamento: string
  horario_inicio: string
  horario_fim: string
  tipo_atendimento: string
  status: 'agendada' | 'confirmada' | 'concluida' | 'cancelada' | 'faltou'
  observacoes?: string
  created_at?: string
  updated_at?: string
  // Related objects (populated by joins)
  paciente?: {
    id: string
    nome_completo: string
  }
  profissional?: {
    id: string
    nome_completo: string
    especialidade?: string
  }
  sala?: {
    id: string
    nome: string
  }
}

export interface CreateAgendamentoDTO {
  paciente_id: string
  profissional_id: string
  sala_id?: string
  data_agendamento: string
  horario_inicio: string
  horario_fim: string
  tipo_atendimento: string
  observacoes?: string
}
