'use client'

import { Agendamento } from '@/types'
import { Clock, CalendarDays, MapPin, UserRound, Stethoscope, Edit, Trash2, CheckCircle } from 'lucide-react'
import { agendamentoService } from '@/services/agendamentoService'
import Button from '../common/Button'
import { getUserRole } from '@/utils/auth'

interface AgendamentoCardProps {
  agendamento: Agendamento
  onEdit: (agendamento: Agendamento) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

export default function AgendamentoCard({
  agendamento,
  onEdit,
  onDelete,
  onRefresh
}: AgendamentoCardProps) {
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)

  const statusColors: Record<Agendamento['status'], string> = {
    agendada: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    confirmada: 'bg-blue-100 text-blue-700 border-blue-200',
    concluida: 'bg-green-100 text-green-700 border-green-200',
    cancelada: 'bg-red-100 text-red-700 border-red-200',
    faltou: 'bg-orange-100 text-orange-700 border-orange-200'
  }

  const handleConfirm = async () => {
    try {
      await agendamentoService.confirm(agendamento.id)
      onRefresh()
    } catch (error) {
      console.error('Erro ao confirmar:', error)
    }
  }

  const handleComplete = async () => {
    try {
      await agendamentoService.complete(agendamento.id)
      onRefresh()
    } catch (error) {
      console.error('Erro ao concluir:', error)
    }
  }

  const handleMarkAsMissed = async () => {
    try {
      await agendamentoService.markAsMissed(agendamento.id)
      onRefresh()
    } catch (error) {
      console.error('Erro ao marcar falta:', error)
    }
  }

  const pacienteNome =
    agendamento.paciente?.nome_completo ||
    (agendamento as any).paciente_nome ||
    'Paciente não informado'

  const profissionalNome =
    agendamento.profissional?.nome_completo ||
    (agendamento as any).profissional_nome ||
    'Profissional não informado'

  return (
    <div className="bg-white rounded-xl p-4 lg:p-5 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-neutral-700">
            <span className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
              <Clock className="w-4 h-4" />
              {agendamento.horario_inicio} - {agendamento.horario_fim}
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-neutral-600">
              <CalendarDays className="w-4 h-4" />
              {agendamento.data_agendamento}
            </span>
          </div>

          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[agendamento.status]}`}>
            {agendamento.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2">
            <UserRound className="w-4 h-4 text-neutral-500 mt-0.5" />
            <div>
              <p className="text-xs text-neutral-500">Paciente</p>
              <p className="font-semibold text-neutral-900">{pacienteNome}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2">
            <Stethoscope className="w-4 h-4 text-neutral-500 mt-0.5" />
            <div>
              <p className="text-xs text-neutral-500">Profissional</p>
              <p className="font-semibold text-neutral-900">{profissionalNome}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {agendamento.sala?.nome && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {agendamento.sala.nome}
            </span>
          )}

          {agendamento.tipo_atendimento && (
            <div className="text-sm text-neutral-500 font-medium">
              {agendamento.tipo_atendimento}
            </div>
          )}

          {agendamento.observacoes && (
            <span className="text-sm text-neutral-600 italic truncate max-w-full">
              {agendamento.observacoes}
            </span>
          )}
        </div>

        {!isProfissional && (
          <div className="flex flex-wrap gap-2">
            {agendamento.status === 'agendada' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleConfirm}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Confirmar
              </Button>
            )}

            {(agendamento.status === 'agendada' || agendamento.status === 'confirmada') && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleComplete}
                >
                  Concluir
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleMarkAsMissed}
                >
                  Faltou
                </Button>
              </>
            )}

            {agendamento.status !== 'concluida' && agendamento.status !== 'cancelada' && (
              <>  
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(agendamento)}
                  icon={<Edit className="w-4 h-4" />}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(agendamento.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Excluir
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
