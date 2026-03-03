'use client'

import { Agendamento } from '@/types'
import { Clock, MapPin, User, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { agendamentoService } from '@/services/agendamentoService'
import Button from '../common/Button'

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

  return (
    <div className="bg-white rounded-lg p-4 lg:p-6 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Time */}
        <div className="flex items-center gap-2 text-neutral-700">
          <Clock className="w-5 h-5 text-primary-500" />
          <span className="font-semibold">
            {agendamento.horario_inicio} - {agendamento.horario_fim}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <User className="w-5 h-5 text-neutral-400 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">
                {agendamento.paciente?.nome_completo}
              </p>
              <p className="text-sm text-neutral-600">
                {agendamento.profissional?.nome_completo}
              </p>
            </div>
          </div>

          {agendamento.sala && (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <MapPin className="w-4 h-4" />
              <span>{agendamento.sala.nome}</span>
            </div>
          )}

          {agendamento.tipo_atendimento && (
            <div className="text-sm text-neutral-500">
              {agendamento.tipo_atendimento}
            </div>
          )}

          {agendamento.observacoes && (
            <div className="text-sm text-neutral-600 italic">
              {agendamento.observacoes}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[agendamento.status]}`}>
            {agendamento.status}
          </span>
        </div>

        {/* Actions */}
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
      </div>
    </div>
  )
}
