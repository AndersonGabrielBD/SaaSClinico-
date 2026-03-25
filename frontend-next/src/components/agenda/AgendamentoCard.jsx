'use client'

import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, UserRound, Stethoscope, Edit, Trash2, CheckCircle, AlertCircle, ChevronDown, Clock } from 'lucide-react'
import { agendamentoService } from '@/services/agendamentoService'
import { frequenciaService } from '@/services/frequenciaService'
import * as api from '@/lib/api'
import Button from '@/components/common/Button'
import { getUserRole } from '@/utils/auth'
import { formatTimeHHmm } from '@/lib/dateUtils'

export const STATUS_COLORS = {
  agendada:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmada:     'bg-blue-100 text-blue-700 border-blue-200',
  em_atendimento: 'bg-purple-100 text-purple-700 border-purple-200',
  concluida:      'bg-green-100 text-green-700 border-green-200',
  cancelada:      'bg-red-100 text-red-700 border-red-200',
  faltou:         'bg-orange-100 text-orange-700 border-orange-200',
}

export const STATUS_SIDEBAR = {
  agendada:       'bg-yellow-400',
  confirmada:     'bg-blue-500',
  em_atendimento: 'bg-purple-500',
  concluida:      'bg-green-500',
  cancelada:      'bg-red-400',
  faltou:         'bg-orange-400',
}

export const STATUS_LABELS = {
  agendada:       'Agendada',
  confirmada:     'Confirmada',
  em_atendimento: 'Em Atendimento',
  concluida:      'Concluída',
  cancelada:      'Cancelada',
  faltou:         'Faltou',
}

export default function AgendamentoCard({
  agendamento,
  onEdit,
  onDelete,
  onRefresh,
  showToast,
  compact = false,
}) {
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
  const [showConcluirModal, setShowConcluirModal] = useState(false)
  const [concluirMode, setConcluirMode] = useState('concluida')
  const [profissionais, setProfissionais] = useState([])
  const [concluirForm, setConcluirForm] = useState({
    compareceu: true,
    profissional_id: '',
    observacoes: ''
  })
  const [concluirLoading, setConcluirLoading] = useState(false)
  const [showActionsDropdown, setShowActionsDropdown] = useState(false)
  const actionsButtonRef = useRef(null)
  const [dropdownRect, setDropdownRect] = useState(null)

  const updateDropdownPosition = useCallback(() => {
    const el = actionsButtonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (typeof window === 'undefined') return
    const padding = 8
    const desiredWidth = Math.max(r.width, 170)
    const maxWidth = Math.max(0, window.innerWidth - padding * 2)
    const width = Math.min(desiredWidth, maxWidth)
    const left = Math.min(
      Math.max(padding, r.right - width),
      window.innerWidth - width - padding
    )
    setDropdownRect({
      top: r.bottom + 4,
      left,
      width,
    })
  }, [])

  /** Abre/fecha menu — posição medida no clique (evita 1º render sem rect / ref ainda null). */
  const toggleActionsDropdown = useCallback((e) => {
    e.stopPropagation()
    if (showActionsDropdown) {
      setShowActionsDropdown(false)
      setDropdownRect(null)
      return
    }
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    if (typeof window === 'undefined') return
    const padding = 8
    const desiredWidth = Math.max(r.width, 170)
    const maxWidth = Math.max(0, window.innerWidth - padding * 2)
    const width = Math.min(desiredWidth, maxWidth)
    const left = Math.min(
      Math.max(padding, r.right - width),
      window.innerWidth - width - padding
    )
    setDropdownRect({
      top: r.bottom + 4,
      left,
      width,
    })
    setShowActionsDropdown(true)
  }, [showActionsDropdown])

  const closeActionsDropdown = useCallback(() => {
    setShowActionsDropdown(false)
    setDropdownRect(null)
  }, [])

  useLayoutEffect(() => {
    if (!compact || !showActionsDropdown) {
      return
    }
    updateDropdownPosition()
    const onScrollOrResize = () => updateDropdownPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [compact, showActionsDropdown, updateDropdownPosition])

  const loadProfissionais = async () => {
    try {
      const data = await api.getProfissionais({ ativo: true })
      const list = data?.data || data || []
      setProfissionais(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error)
      setProfissionais([])
    }
  }

  const handleConfirm = async () => {
    try {
      await agendamentoService.confirm(agendamento.id)
      onRefresh()
      showToast?.('Agendamento confirmado!', 'success')
    } catch (error) {
      console.error('Erro ao confirmar:', error)
    }
  }

  const openConcluirModal = (mode) => {
    setConcluirMode(mode)
    setConcluirForm({
      compareceu: mode === 'concluida',
      profissional_id: agendamento.profissional_id || '',
      observacoes: ''
    })
    loadProfissionais()
    setShowConcluirModal(true)
    closeActionsDropdown()
  }

  const handleConcluirConfirm = async () => {
    if (!concluirForm.profissional_id) {
      showToast?.('Selecione o profissional que atendeu', 'error')
      return
    }
    setConcluirLoading(true)
    try {
      const status = concluirMode === 'concluida' ? 'concluida' : 'faltou'
      await agendamentoService.updateStatus(agendamento.id, status)
      await frequenciaService.registrar({
        paciente_id: agendamento.paciente_id,
        profissional_id: concluirForm.profissional_id,
        agendamento_id: agendamento.id,
        data_atendimento: agendamento.data_agendamento,
        compareceu: concluirForm.compareceu,
        observacoes: concluirForm.observacoes || null
      })
      if (agendamento.pacote_item_id) {
        try { localStorage.setItem('pacotes_refresh_needed', Date.now().toString()) } catch (_) {}
      }
      setShowConcluirModal(false)
      onRefresh()
      showToast?.(concluirMode === 'concluida' ? 'Agendamento concluído e frequência registrada!' : 'Falta registrada.', 'success')
    } catch (error) {
      console.error('Erro ao concluir:', error)
      showToast?.(error?.message || 'Erro ao concluir agendamento', 'error')
    } finally {
      setConcluirLoading(false)
    }
  }

  const handleComplete = () => openConcluirModal('concluida')
  const handleMarkAsMissed = () => openConcluirModal('faltou')

  const pacienteNome =
    agendamento.paciente?.nome_completo ||
    agendamento.paciente_nome ||
    'Paciente não informado'

  const profissionalNome =
    agendamento.profissional?.nome_completo ||
    agendamento.profissional_nome ||
    'Profissional não informado'

  const statusLabel = STATUS_LABELS[agendamento.status] || agendamento.status

  // ─── COMPACT MODE (para linha do tempo) ──────────────────────────────────
  if (compact) {
    return (
      <>
        {/* Sem overflow-hidden: senão o menu (absolute) fica recortado e some */}
        <div className="relative flex items-stretch bg-white rounded-lg border border-neutral-100 shadow-sm overflow-visible group hover:shadow-md transition-shadow">
          {/* Barra lateral colorida */}
          <div className={`w-1.5 flex-shrink-0 rounded-l-lg ${STATUS_SIDEBAR[agendamento.status] || 'bg-neutral-300'}`} />

          {/* Conteúdo principal */}
          <div className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0">
            {/* Nome paciente + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-neutral-900 truncate">{pacienteNome}</span>
                {agendamento.recorrencia_id && (
                  <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100 flex-shrink-0">Rec.</span>
                )}
                {agendamento.pacote_item_id && (
                  <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100 flex-shrink-0">Pacote</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 flex-wrap">
                <span className="flex items-center gap-0.5">
                  <Stethoscope className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{profissionalNome}</span>
                </span>
                {agendamento.tipo_atendimento && (
                  <span className="text-neutral-400">| {agendamento.tipo_atendimento}</span>
                )}
                {agendamento.sala?.nome && (
                  <span className="flex items-center gap-0.5 text-neutral-400">
                    <MapPin className="w-3 h-3" />{agendamento.sala.nome}
                  </span>
                )}
              </div>
            </div>

            {/* Horário fim */}
            <div className="flex-shrink-0 text-right hidden sm:block">
              <span className="text-xs text-neutral-400">até {formatTimeHHmm(agendamento.horario_fim)}</span>
            </div>

            {/* Status badge */}
            <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLORS[agendamento.status] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
              {statusLabel}
            </span>

            {/* Ações dropdown — portal + fixed para não ser recortado por overflow da timeline */}
            {!isProfissional && (
              <div className="relative flex-shrink-0">
                <button
                  ref={actionsButtonRef}
                  type="button"
                  aria-expanded={showActionsDropdown}
                  aria-haspopup="menu"
                  onClick={toggleActionsDropdown}
                  className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showActionsDropdown && typeof document !== 'undefined' && dropdownRect && createPortal(
                  <>
                    <div
                      className="fixed inset-0 bg-transparent"
                      aria-hidden
                      style={{ zIndex: 100000 }}
                      onClick={() => closeActionsDropdown()}
                    />
                    <div
                      role="menu"
                      className="fixed bg-white border border-neutral-200 rounded-lg shadow-xl py-1 max-h-[min(70vh,480px)] overflow-y-auto"
                      style={{
                        zIndex: 100001,
                        top: dropdownRect.top,
                        left: dropdownRect.left,
                        width: dropdownRect.width,
                        maxWidth: 'calc(100vw - 16px)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {agendamento.status === 'agendada' && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { handleConfirm(); closeActionsDropdown() }}
                          className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4 text-blue-500" /> Confirmar
                        </button>
                      )}
                      {(agendamento.status === 'agendada' || agendamento.status === 'confirmada' || agendamento.status === 'em_atendimento') && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openConcluirModal('concluida')}
                            className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" /> Concluir
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openConcluirModal('faltou')}
                            className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                          >
                            <AlertCircle className="w-4 h-4 text-orange-500" /> Faltou
                          </button>
                        </>
                      )}
                      {agendamento.status !== 'concluida' && agendamento.status !== 'cancelada' && (
                        <>
                          <div className="border-t border-neutral-100 my-1" />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { onEdit(agendamento); closeActionsDropdown() }}
                            className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4 text-neutral-400" /> Editar
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { onDelete(agendamento); closeActionsDropdown() }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Concluir/Faltou */}
        {showConcluirModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-primary-600" />
                <h2 className="text-lg font-bold">
                  {concluirMode === 'concluida' ? 'Concluir e registrar frequência' : 'Marcar falta e registrar'}
                </h2>
              </div>
              <p className="text-sm text-neutral-600 mb-4">
                {concluirMode === 'concluida'
                  ? 'O paciente compareceu? Confirme o profissional que realizou o atendimento.'
                  : 'Registre a falta e informe o profissional que estava agendado.'}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Paciente compareceu?</label>
                  <select
                    value={concluirForm.compareceu}
                    onChange={(e) => setConcluirForm({ ...concluirForm, compareceu: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={true}>Sim</option>
                    <option value={false}>Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Profissional que atendeu</label>
                  <select
                    value={concluirForm.profissional_id}
                    onChange={(e) => setConcluirForm({ ...concluirForm, profissional_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Selecione o profissional</option>
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome_completo || p.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Observações (opcional)</label>
                  <textarea
                    value={concluirForm.observacoes}
                    onChange={(e) => setConcluirForm({ ...concluirForm, observacoes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Observações..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowConcluirModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConcluirConfirm}
                  disabled={concluirLoading || !concluirForm.profissional_id}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {concluirLoading ? 'Salvando...' : concluirMode === 'concluida' ? 'Concluir e registrar' : 'Registrar falta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ─── FULL MODE (modo padrão) ──────────────────────────────────────────────
  return (
    <>
      <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Top bar — time + status */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{formatTimeHHmm(agendamento.horario_inicio)} – {formatTimeHHmm(agendamento.horario_fim)}</span>
            </div>
            <span className="text-xs text-neutral-400 hidden sm:inline">
              {agendamento.data_agendamento}
            </span>
            {agendamento.recorrencia_id && (
              <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Recorrente
              </span>
            )}
            {agendamento.pacote_item_id && (
              <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                Pacote
              </span>
            )}
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_COLORS[agendamento.status] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
            {statusLabel}
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

        {/* Meta info */}
        {(agendamento.sala?.nome || agendamento.tipo_atendimento || agendamento.observacoes) && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-neutral-50/60 border-t border-neutral-50 text-xs text-neutral-500">
            {agendamento.sala?.nome && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{agendamento.sala.nome}</span>
            )}
            {agendamento.tipo_atendimento && (
              <span className="font-medium text-neutral-600">{agendamento.tipo_atendimento}</span>
            )}
            {agendamento.observacoes && (
              <span className="italic truncate max-w-[200px]">{agendamento.observacoes}</span>
            )}
          </div>
        )}

        {/* Motivo de cancelamento */}
        {agendamento.status === 'cancelada' && agendamento.motivo_cancelamento && (
          <div className="flex items-start gap-2 px-4 py-2 bg-red-50/60 border-t border-red-100 text-xs text-red-700">
            <span className="font-semibold shrink-0">Motivo:</span>
            <span>{agendamento.motivo_cancelamento}</span>
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
            {agendamento.status === 'em_atendimento' && (
              <Button size="sm" variant="primary" onClick={handleComplete}>Concluir</Button>
            )}
            {agendamento.status !== 'concluida' && agendamento.status !== 'cancelada' && (
              <div className="flex items-center gap-1 ml-auto">
                <Button size="sm" variant="ghost" onClick={() => onEdit(agendamento)} icon={<Edit className="w-3.5 h-3.5" />} />
                <Button size="sm" variant="ghost" onClick={() => onDelete(agendamento)} icon={<Trash2 className="w-3.5 h-3.5" />} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Concluir/Faltou */}
      {showConcluirModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-primary-600" />
              <h2 className="text-lg font-bold">
                {concluirMode === 'concluida' ? 'Concluir e registrar frequência' : 'Marcar falta e registrar'}
              </h2>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              {concluirMode === 'concluida'
                ? 'O paciente compareceu? Confirme o profissional que realizou o atendimento.'
                : 'Registre a falta e informe o profissional que estava agendado.'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Paciente compareceu?</label>
                <select
                  value={concluirForm.compareceu}
                  onChange={(e) => setConcluirForm({ ...concluirForm, compareceu: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value={true}>Sim</option>
                  <option value={false}>Não</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Profissional que atendeu</label>
                <select
                  value={concluirForm.profissional_id}
                  onChange={(e) => setConcluirForm({ ...concluirForm, profissional_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione o profissional</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome_completo || p.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Observações (opcional)</label>
                <textarea
                  value={concluirForm.observacoes}
                  onChange={(e) => setConcluirForm({ ...concluirForm, observacoes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Observações..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConcluirModal(false)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConcluirConfirm}
                disabled={concluirLoading || !concluirForm.profissional_id}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {concluirLoading ? 'Salvando...' : concluirMode === 'concluida' ? 'Concluir e registrar' : 'Registrar falta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
