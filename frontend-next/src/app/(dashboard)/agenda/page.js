'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { agendamentoService } from '@/services/agendamentoService'
import { Plus, Search, FileDown, AlertTriangle, ChevronLeft, ChevronRight, Menu, X, Calendar, Clock, List } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import AgendamentoForm from '@/components/agenda/AgendamentoForm'
import AgendamentoCard from '@/components/agenda/AgendamentoCard'
import CalendarView from '@/components/agenda/CalendarView'
import Toast from '@/components/common/Toast'
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getTodayBrazil } from '@/lib/dateUtils'
import { useAuth } from '@/context/AuthContext'
import { getUserRole } from '@/utils/auth'
import * as apiMethods from '@/lib/api'
import { api } from '@/lib/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function gerarSlots(inicio = '07:00', fim = '20:00', intervalo = 20) {
  const slots = []
  let [h, m] = inicio.split(':').map(Number)
  const [hFim, mFim] = fim.split(':').map(Number)
  while (h < hFim || (h === hFim && m <= mFim)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += intervalo
    if (m >= 60) { h++; m -= 60 }
  }
  return slots
}

const SLOTS = gerarSlots('07:00', '20:00', 20)

function normalizeTime(t) {
  if (!t) return ''
  return t.substring(0, 5)
}

function slotParaHorario(horario) {
  const norm = normalizeTime(horario)
  let match = SLOTS[0]
  for (const s of SLOTS) {
    if (s <= norm) match = s
    else break
  }
  return match
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Mini-calendário (sidebar) ────────────────────────────────────────────────

function MiniCalendario({ selectedDate, onDateChange, agendamentos }) {
  const today = getTodayBrazil()
  const selectedParsed = parseDateLocal(selectedDate)
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedParsed.getFullYear(), selectedParsed.getMonth(), 1))

  useEffect(() => {
    const sel = parseDateLocal(selectedDate)
    if (!isSameMonth(sel, currentMonth)) {
      setCurrentMonth(new Date(sel.getFullYear(), sel.getMonth(), 1))
    }
  }, [selectedDate])

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const allDays = eachDayOfInterval({ start, end })
    const startPad = getDay(start)
    const padded = [...Array(startPad).fill(null), ...allDays]
    while (padded.length % 7 !== 0) padded.push(null)
    return padded
  }, [currentMonth])

  const datesWithAppointments = useMemo(() => {
    const set = new Set()
    for (const a of agendamentos) {
      if (a.data_agendamento) set.add(a.data_agendamento)
    }
    return set
  }, [agendamentos])

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded hover:bg-neutral-100 text-neutral-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-neutral-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-neutral-100 text-neutral-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-neutral-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />
          const dayStr = format(day, 'yyyy-MM-dd')
          const isSelected = dayStr === selectedDate
          const isToday = dayStr === today
          const hasAppointment = datesWithAppointments.has(dayStr)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          return (
            <button
              key={dayStr}
              onClick={() => onDateChange(dayStr)}
              className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-lg text-xs font-medium transition-colors
                ${isSelected ? 'bg-primary-600 text-white' : isToday ? 'bg-primary-50 text-primary-700' : 'hover:bg-neutral-100'}
                ${!isCurrentMonth ? 'text-neutral-300' : isSelected ? 'text-white' : 'text-neutral-700'}
              `}
            >
              {format(day, 'd')}
              {hasAppointment && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Modal de período para PDF ────────────────────────────────────────────────

function ModalExportPdf({ isOpen, onClose, onExport, exporting }) {
  const today = getTodayBrazil()
  const [dataInicio, setDataInicio] = useState(today)
  const [dataFim, setDataFim] = useState(today)

  if (!isOpen) return null

  const handleExport = () => {
    if (!dataInicio || !dataFim) return
    if (dataInicio > dataFim) return
    onExport(dataInicio, dataFim)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl mx-4">
        <h2 className="text-base font-bold text-neutral-900 mb-4">Exportar Agenda em PDF</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {dataInicio > dataFim && (
            <p className="text-xs text-red-600">A data fim deve ser igual ou posterior à data início.</p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !dataInicio || !dataFim || dataInicio > dataFim}
            className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Gerando...' : 'Baixar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AgendaPage() {
  const { user } = useAuth()
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)

  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // View: 'timeline' | 'calendar'
  const [viewMode, setViewMode] = useState('timeline')

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profissionais, setProfissionais] = useState([])
  const [salas, setSalas] = useState([])
  const [filtros, setFiltros] = useState({
    profissional_id: '',
    sala_id: '',
    status: ''
  })

  // Agenda
  const [selectedDate, setSelectedDate] = useState(getTodayBrazil())
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgendamento, setEditingAgendamento] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Modal de cancelamento
  const [cancelConfirm, setCancelConfirm] = useState({ open: false, id: null, motivo: '', recorrenciaId: null, dataAgendamento: null })
  const [cancelScope, setCancelScope] = useState('single')

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type })
  }, [])

  // Carrega profissionais e salas para os filtros
  useEffect(() => {
    const loadFiltros = async () => {
      try {
        const profData = await apiMethods.getProfissionais({ ativo: true })
        // backend retorna array direto; some wrappers retornam { data: [...] }
        const profList = Array.isArray(profData) ? profData : (profData?.data ?? [])
        setProfissionais(profList)
      } catch (e) {
        console.error('Erro ao carregar profissionais:', e)
      }
      try {
        const salaData = await apiMethods.getSalas({ ativo: true })
        const salaList = Array.isArray(salaData) ? salaData : (salaData?.data ?? [])
        setSalas(salaList)
      } catch (e) {
        console.error('Erro ao carregar salas:', e)
      }
    }
    loadFiltros()
  }, [])

  // Garante filtro travado para usuários profissional
  useEffect(() => {
    if (isProfissional && user?.id) {
      setFiltros(prev => ({ ...prev, profissional_id: user.id }))
    }
  }, [isProfissional, user?.id])

  const loadAgendamentos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let filters = {}
      if (viewMode === 'calendar') {
        // Carrega o mês inteiro para o calendário
        const [y, m] = selectedDate.split('-').map(Number)
        const startOfMon = new Date(y, m - 1, 1)
        const endOfMon = new Date(y, m, 0)
        filters.data_inicio = format(startOfMon, 'yyyy-MM-dd')
        filters.data_fim = format(endOfMon, 'yyyy-MM-dd')
      } else {
        filters.data_agendamento = selectedDate
      }

      if (filtros.profissional_id) filters.profissional_id = filtros.profissional_id

      const result = await agendamentoService.getAll(filters)
      let data = result.data || result || []

      if (isProfissional && user?.id) {
        data = data.filter(a => a.profissional_id === user.id)
      }
      setAgendamentos(data)
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('Backend não está respondendo.')
      } else {
        setError(err.message || 'Erro ao carregar agendamentos')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedDate, viewMode, filtros.profissional_id, isProfissional, user?.id])

  useEffect(() => {
    loadAgendamentos()
  }, [loadAgendamentos])

  // Filtragem frontend (sala + status + search)
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      if (filtros.sala_id && a.sala_id !== filtros.sala_id) return false
      if (filtros.status && a.status !== filtros.status) return false
      if (searchTerm) {
        const s = searchTerm.toLowerCase()
        return (
          a.paciente?.nome_completo?.toLowerCase().includes(s) ||
          a.paciente_nome?.toLowerCase().includes(s) ||
          a.profissional?.nome_completo?.toLowerCase().includes(s) ||
          a.tipo_atendimento?.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [agendamentos, filtros.sala_id, filtros.status, searchTerm])

  // Agrupa por slot de horário (para timeline)
  const agendamentosPorSlot = useMemo(() => {
    const map = {}
    for (const a of filteredAgendamentos) {
      const slot = slotParaHorario(a.horario_inicio)
      if (!map[slot]) map[slot] = []
      map[slot].push(a)
    }
    return map
  }, [filteredAgendamentos])

  // Contadores
  const counts = useMemo(() => ({
    agendadas: agendamentos.filter(a => ['agendada', 'confirmada', 'em_atendimento'].includes(a.status)).length,
    concluidas: agendamentos.filter(a => a.status === 'concluida').length,
    canceladas: agendamentos.filter(a => a.status === 'cancelada').length,
    faltou: agendamentos.filter(a => a.status === 'faltou').length,
    total: agendamentos.length,
  }), [agendamentos])

  const handleCreate = () => {
    if (isProfissional) return
    setEditingAgendamento(null)
    setModalOpen(true)
  }

  const handleEdit = useCallback((agendamento) => {
    if (isProfissional) return
    setEditingAgendamento(agendamento)
    setModalOpen(true)
  }, [isProfissional])

  const handleDelete = useCallback((agendamento) => {
    setCancelScope('single')
    setCancelConfirm({
      open: true,
      id: agendamento.id,
      motivo: '',
      recorrenciaId: agendamento.recorrencia_id || null,
      dataAgendamento: agendamento.data_agendamento || null,
    })
  }, [])

  const confirmCancel = async () => {
    try {
      const { id, motivo, recorrenciaId, dataAgendamento } = cancelConfirm
      if (recorrenciaId && cancelScope !== 'single') {
        const fromDate = cancelScope === 'from_date' ? dataAgendamento : undefined
        await agendamentoService.cancelByRecorrenciaId(recorrenciaId, fromDate, motivo || undefined)
        showToast(cancelScope === 'from_date' ? 'Agendamentos a partir desta data cancelados' : 'Todos os agendamentos da série foram cancelados')
      } else {
        await agendamentoService.cancel(id, motivo || undefined)
        showToast('Agendamento cancelado com sucesso')
      }
      setCancelConfirm({ open: false, id: null, motivo: '', recorrenciaId: null, dataAgendamento: null })
      await loadAgendamentos()
    } catch (err) {
      console.error(err)
      showToast('Erro ao cancelar agendamento', 'error')
    }
  }

  const handleSave = async () => {
    setModalOpen(false)
    await loadAgendamentos()
    showToast('Agendamento salvo com sucesso')
  }

  const handleExportPdf = async (dataInicio, dataFim) => {
    try {
      setExportingPdf(true)
      const params = new URLSearchParams()
      params.append('data_inicio', dataInicio)
      params.append('data_fim', dataFim)
      if (isProfissional && user?.id) params.append('profissional_id', user.id)
      const response = await api.download(`/agendamentos/export-pdf?${params}`)
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `agenda_${dataInicio}_${dataFim}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setShowPdfModal(false)
      showToast('PDF exportado com sucesso!')
    } catch {
      showToast('Erro ao exportar agenda em PDF', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  const selectedDateParsed = parseDateLocal(selectedDate)
  const prevDay = () => setSelectedDate(format(subDays(selectedDateParsed, 1), 'yyyy-MM-dd'))
  const nextDay = () => setSelectedDate(format(addDays(selectedDateParsed, 1), 'yyyy-MM-dd'))

  // Quando o CalendarView muda data, muda selectedDate
  const handleCalendarDateChange = (date) => {
    setSelectedDate(date)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-4 sm:-mx-6 -my-4 sm:-my-6">

      {/* ─── Overlay mobile ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── SIDEBAR ────────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-30 lg:z-auto
        max-lg:top-0 max-lg:bottom-0 max-lg:left-0 lg:top-auto lg:bottom-auto lg:left-auto
        lg:h-full
        w-72 max-w-[85vw] flex-shrink-0
        bg-white border-r border-neutral-100
        flex flex-col max-lg:overflow-hidden
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Fechar mobile */}
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3 border-b border-neutral-100 lg:hidden">
          <span className="font-semibold text-neutral-800">Filtros</span>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CTA no topo no mobile: evita depender de scroll/altura do painel inferior */}
        {!isProfissional && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-100 bg-white lg:hidden">
            <button
              type="button"
              onClick={() => { handleCreate(); setSidebarOpen(false) }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4 space-y-6 touch-pan-y">
          {/* Mini-calendário */}
          <MiniCalendario
            selectedDate={selectedDate}
            onDateChange={(d) => { setSelectedDate(d); setSidebarOpen(false) }}
            agendamentos={agendamentos}
          />

          <div className="border-t border-neutral-100" />

          {/* Filtro Profissional */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Profissional</label>
            <select
              value={filtros.profissional_id}
              onChange={(e) => setFiltros(f => ({ ...f, profissional_id: e.target.value }))}
              disabled={isProfissional}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white disabled:bg-neutral-50 disabled:cursor-not-allowed"
            >
              <option value="">Todos</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome_completo || p.email}</option>
              ))}
            </select>
          </div>

          {/* Filtro Sala */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Sala</label>
            <select
              value={filtros.sala_id}
              onChange={(e) => setFiltros(f => ({ ...f, sala_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="">Todas</option>
              {salas.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="">Todos</option>
              <option value="agendada">Agendada</option>
              <option value="confirmada">Confirmada</option>
              <option value="em_atendimento">Em Atendimento</option>
              <option value="concluida">Concluída</option>
              <option value="faltou">Faltou</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Legenda de status */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Legenda</p>
            <div className="space-y-1.5">
              {[
                { color: 'bg-yellow-400', label: 'Agendada' },
                { color: 'bg-blue-500',   label: 'Confirmada' },
                { color: 'bg-purple-500', label: 'Em Atendimento' },
                { color: 'bg-green-500',  label: 'Concluída' },
                { color: 'bg-orange-400', label: 'Faltou' },
                { color: 'bg-red-400',    label: 'Cancelada' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                  <span className="text-xs text-neutral-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botão novo agendamento — só no desktop (no mobile o CTA fica no topo) */}
        {!isProfissional && (
          <div className="hidden lg:block flex-shrink-0 px-4 pt-3 pb-4 border-t border-neutral-100 bg-white">
            <button
              type="button"
              onClick={() => { handleCreate(); setSidebarOpen(false) }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>
        )}
      </aside>

      {/* ─── ÁREA PRINCIPAL ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-50/50">
        {/* Header */}
        <div className="bg-white border-b border-neutral-100 px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Botão menu mobile */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
              <Menu className="w-5 h-5" />
            </button>

            {/* Navegação de data — visível apenas no modo timeline */}
            {viewMode === 'timeline' && (
              <div className="flex items-center gap-1">
                <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-sm font-bold text-neutral-900 outline-none bg-transparent cursor-pointer w-[130px] text-center uppercase"
                  />
                </div>
                <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Data por extenso (timeline) */}
            {viewMode === 'timeline' && (
              <span className="hidden md:block text-sm text-neutral-500 font-medium uppercase tracking-wide">
                {format(selectedDateParsed, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}

            {/* Título calendário */}
            {viewMode === 'calendar' && (
              <span className="text-sm font-semibold text-neutral-800">Visualização Mensal</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Contadores (só na timeline) */}
              {viewMode === 'timeline' && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-neutral-500 mr-2">
                  {counts.total > 0 && <span><b className="text-neutral-800">{counts.total}</b> agend.</span>}
                  {counts.concluidas > 0 && <span><b className="text-green-600">{counts.concluidas}</b> concluídas</span>}
                  {counts.canceladas > 0 && <span><b className="text-red-500">{counts.canceladas}</b> canceladas</span>}
                  {counts.faltou > 0 && <span><b className="text-orange-500">{counts.faltou}</b> faltou</span>}
                </div>
              )}

              {/* Busca (só na timeline) */}
              {viewMode === 'timeline' && (
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="pl-8 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white w-48"
                  />
                </div>
              )}

              {/* Toggle view */}
              <div className="flex bg-neutral-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                  title="Linha do tempo"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Horários</span>
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                  title="Calendário mensal"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mês</span>
                </button>
              </div>

              {/* PDF */}
              <button
                onClick={() => setShowPdfModal(true)}
                disabled={exportingPdf}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors disabled:opacity-50"
                title="Exportar PDF"
              >
                <FileDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Busca mobile (só na timeline) */}
          {viewMode === 'timeline' && (
            <div className="relative sm:hidden mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar paciente..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 outline-none bg-white"
              />
            </div>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex-shrink-0">
            <span className="flex-1">{error}</span>
            <button onClick={loadAgendamentos} className="text-xs underline font-medium">Tentar novamente</button>
          </div>
        )}

        {/* ─── CONTEÚDO: TIMELINE ou CALENDÁRIO ───────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6"><LoadingSkeleton rows={6} /></div>
          ) : viewMode === 'calendar' ? (
            // ─── CALENDÁRIO MENSAL ────────────────────────────────────
            <div className="p-4">
              <CalendarView
                agendamentos={filteredAgendamentos}
                selectedDate={selectedDate}
                onDateChange={handleCalendarDateChange}
                onAgendamentoClick={isProfissional ? undefined : handleEdit}
              />
            </div>
          ) : (
            // ─── LINHA DO TEMPO ────────────────────────────────────────
            <div className="py-2">
              {SLOTS.map((slot) => {
                const items = agendamentosPorSlot[slot] || []
                const isEmpty = items.length === 0
                const isHourMark = slot.endsWith(':00')

                return (
                  <div key={slot} className={`flex items-start gap-0 ${isHourMark ? 'mt-1' : ''}`}>
                    {/* Coluna de horário */}
                    <div className={`w-16 flex-shrink-0 text-right pr-3 pt-2.5 ${isHourMark ? 'text-xs font-semibold text-neutral-500' : 'text-[10px] text-neutral-300'}`}>
                      {isHourMark ? slot : ''}
                    </div>

                    {/* Separador */}
                    <div className="w-px bg-neutral-200 self-stretch flex-shrink-0" />

                    {/* Conteúdo do slot */}
                    <div className="flex-1 pl-3 py-1 min-h-[40px]">
                      {isEmpty ? (
                        // Slot vazio — só espaço visual, não clicável
                        <div className="min-h-[36px]" />
                      ) : (
                        // Slots com agendamentos
                        <div className="space-y-1 pr-4">
                          {items.map(agendamento => (
                            <AgendamentoCard
                              key={agendamento.id}
                              agendamento={agendamento}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onRefresh={loadAgendamentos}
                              showToast={showToast}
                              compact={true}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── Modal criação/edição ────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
        size="lg"
      >
        <AgendamentoForm
          agendamento={editingAgendamento}
          onSuccess={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* ─── Modal cancelamento ─────────────────────────────────── */}
      <Modal
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false, id: null, motivo: '', recorrenciaId: null, dataAgendamento: null })}
        title="Cancelar Agendamento"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">Cancelar este agendamento?</p>
              <p className="text-sm text-neutral-500 mt-1">O status será alterado para &quot;Cancelado&quot;.</p>
            </div>
          </div>

          {cancelConfirm.recorrenciaId && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Este agendamento é recorrente</p>
              {[
                { value: 'single',    label: 'Cancelar só este' },
                { value: 'from_date', label: 'Cancelar este e os futuros da série' },
                { value: 'all',       label: 'Cancelar todos da série' },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${cancelScope === value ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                >
                  <input
                    type="radio"
                    name="cancelScope"
                    value={value}
                    checked={cancelScope === value}
                    onChange={() => setCancelScope(value)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-neutral-700">{label}</span>
                </label>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Motivo do cancelamento
              <span className="text-neutral-400 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              value={cancelConfirm.motivo}
              onChange={(e) => setCancelConfirm(prev => ({ ...prev, motivo: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Ex: paciente solicitou remarcação..."
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setCancelConfirm({ open: false, id: null, motivo: '', recorrenciaId: null, dataAgendamento: null })}>
              Voltar
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmCancel}>
              Confirmar Cancelamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal PDF ───────────────────────────────────────────── */}
      <ModalExportPdf
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        onExport={handleExportPdf}
        exporting={exportingPdf}
      />

      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
