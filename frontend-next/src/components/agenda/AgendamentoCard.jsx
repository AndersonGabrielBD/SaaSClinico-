'use client'

import { Clock, CalendarDays, MapPin, UserRound, Stethoscope, Edit, Trash2, CheckCircle } from 'lucide-react'
import { agendamentoService } from '@/services/agendamentoService'
import Button from '@/components/common/Button'
import { getUserRole } from '@/utils/auth'

export default function AgendamentoCard({
  agendamento,
  onEdit,
  onDelete,
  onRefresh
}) {
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)

  const statusColors = {
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
    agendamento.paciente_nome ||
    'Paciente não informado'

  const profissionalNome =
    agendamento.profissional?.nome_completo ||
    agendamento.profissional_nome ||
    'Profissional não informado'

  return (
    <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Top bar — time + status */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{agendamento.horario_inicio} – {agendamento.horario_fim}</span>
          </div>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            {agendamento.data_agendamento}
          </span>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusColors[agendamento.status]}`}>
          {agendamento.status}
        </span>
      </div>

      {/* Patient + Professional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-neutral-50">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <UserRound className="w-4 h-4 text-neutral-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Paciente</p>
            <p className="text-sm font-semibold text-neutral-900 truncate">{pacienteNome}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Stethoscope className="w-4 h-4 text-neutral-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Profissional</p>
            <p className="text-sm font-medium text-neutral-700 truncate">{profissionalNome}</p>
          </div>
        </div>
      </div>

      {/* Meta info (sala, tipo, obs) */}
      {(agendamento.sala?.nome || agendamento.tipo_atendimento || agendamento.observacoes) && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-neutral-50/60 border-t border-neutral-50 text-xs text-neutral-500">
          {agendamento.sala?.nome && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{agendamento.sala.nome}
            </span>
          )}
          {agendamento.tipo_atendimento && (
            <span className="font-medium text-neutral-600">{agendamento.tipo_atendimento}</span>
          )}
          {agendamento.observacoes && (
            <span className="italic truncate max-w-[200px]">{agendamento.observacoes}</span>
          )}
        </div>
      )}

      {/* Actions */}
      {!isProfissional && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-t border-neutral-50">
          {agendamento.status === 'agendada' && (
            <Button size="sm" variant="outline" onClick={handleConfirm} icon={<CheckCircle className="w-3.5 h-3.5" />}>
              Confirmar
            </Button>
          )}
          {(agendamento.status === 'agendada' || agendamento.status === 'confirmada') && (
            <>
              <Button size="sm" variant="primary" onClick={handleComplete}>Concluir</Button>
              <Button size="sm" variant="secondary" onClick={handleMarkAsMissed}>Faltou</Button>
            </>
          )}
          {agendamento.status !== 'concluida' && agendamento.status !== 'cancelada' && (
            <div className="flex items-center gap-1 ml-auto">
              <Button size="sm" variant="ghost" onClick={() => onEdit(agendamento)} icon={<Edit className="w-3.5 h-3.5" />} />
              <Button size="sm" variant="ghost" onClick={() => onDelete(agendamento.id)} icon={<Trash2 className="w-3.5 h-3.5" />} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
