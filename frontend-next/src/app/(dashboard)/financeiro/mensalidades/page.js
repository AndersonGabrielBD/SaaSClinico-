'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { mensalidadeService } from '@/services/mensalidadeService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { getTodayBrazil, getFirstDayOfMonthBrazil, getCurrentYearMonthBrazil, parseDateSafe } from '@/lib/dateUtils'
import {
  DollarSign,
  Edit,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  Plus,
  TrendingUp,
  Users,
  Archive,
  X,
  Clock,
  ShieldX,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react'
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, addMonths, subMonths, isSameMonth, isToday, getDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ResponsiveTable from '@/components/common/ResponsiveTable'

const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const normalizeDateKey = (val) => {
  if (val == null) return ''
  if (typeof val === 'string') return val.slice(0, 10)
  if (val instanceof Date) return format(val, 'yyyy-MM-dd')
  if (typeof val === 'object' && typeof val.toISOString === 'function') return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

const METODOS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque', label: 'Cheque' },
]

export default function MensalidadesPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [mensalidadesInativas, setMensalidadesInativas] = useState([])
  const [pagamentosMesMap, setPagamentosMesMap] = useState({})
  const [proximosVencimentos, setProximosVencimentos] = useState([])
  const [estatisticas, setEstatisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedMensalidade, setSelectedMensalidade] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('ativas')
  const [calendarioMesAno, setCalendarioMesAno] = useState(() => {
    const { year, month } = getCurrentYearMonthBrazil()
    return { year, month }
  })
  const [pagamentosCalendario, setPagamentosCalendario] = useState([])
  const [loadingCalendario, setLoadingCalendario] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState(null)

  const [pagamentoParaPagar, setPagamentoParaPagar] = useState(null)
  const [valorPagoModal, setValorPagoModal] = useState('')
  const [metodoPagamentoModal, setMetodoPagamentoModal] = useState('pix')
  const [observacoesPagamentoModal, setObservacoesPagamentoModal] = useState('')

  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null })

  useEffect(() => {
    const userRole = getUserRole()
    const canAccess = canAccessModule(userRole, 'financeiro')
    setHasAccess(canAccess)
    if (!canAccess && userRole) {
      const timeout = setTimeout(() => router.push('/pacientes'), 2000)
      return () => clearTimeout(timeout)
    }
  }, [router])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm })
  }

  const getUltimoDiaMes = (year, month) => new Date(year, month, 0).getDate()

  const getDiasAteVencimento = (mensalidade) => {
    const dia = Number(mensalidade?.dia_vencimento)
    if (!dia || dia < 1 || dia > 31) return null
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const y = hoje.getFullYear()
    const m = hoje.getMonth()
    const ultimoDia = getUltimoDiaMes(y, m + 1)
    const diaVenc = Math.min(dia, ultimoDia)
    let vencimento = new Date(y, m, diaVenc)
    if (vencimento < hoje) {
      const nextM = m + 1
      const nextY = nextM > 11 ? y + 1 : y
      const nextMNorm = nextM % 12
      const ultimoProx = getUltimoDiaMes(nextY, nextMNorm + 1)
      vencimento = new Date(nextY, nextMNorm, Math.min(dia, ultimoProx))
    }
    return Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24))
  }

  const deveExibirLembrete = (dias) => dias !== null && dias > 0 && dias <= 3

  const proximosVencimentosFromDia = (() => {
    const list = []
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const y = hoje.getFullYear()
    const m = hoje.getMonth()
    for (const men of mensalidades) {
      const dias = getDiasAteVencimento(men)
      if (dias == null || dias < 0 || dias > 3) continue
      const pag = pagamentosMesMap[men.id]
      if (!pag || String(pag.status || '').toLowerCase() === 'pago') continue
      const ultimoDia = getUltimoDiaMes(y, m + 1)
      const diaVen = Math.min(Number(men.dia_vencimento) || 1, ultimoDia)
      const dataVenc = new Date(y, m, diaVen)
      list.push({
        pagamento_id: pag.id,
        id: pag.id,
        paciente_nome: men.paciente_nome || 'Paciente',
        valor_pago: pag.valor_pago ?? men.valor_mensalidade,
        valor_mensalidade: men.valor_mensalidade,
        data_vencimento: format(dataVenc, 'yyyy-MM-dd'),
        dias_ate_vencimento: dias,
      })
    }
    return list.sort((a, b) => a.dias_ate_vencimento - b.dias_ate_vencimento)
  })()

  const getCorLembrete = (dias) => {
    if (!dias || dias <= 0) return null
    if (dias === 1) return 'bg-red-50 border-red-200'
    return 'bg-yellow-50 border-yellow-200'
  }

  useEffect(() => {
    if (hasAccess === true) {
      loadData()
      loadPacientes()
    }
  }, [hasAccess])

  useEffect(() => {
    if (hasAccess === true && abaAtiva === 'calendario') {
      loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
    }
  }, [hasAccess, abaAtiva, calendarioMesAno.year, calendarioMesAno.month])

  const loadData = async () => {
    try {
      setLoading(true)
      const mesReferencia = getFirstDayOfMonthBrazil()
      const [mensalidadesAtivasData, mensalidadesInativasData, vencimentosData, statsData, pagamentosMes] = await Promise.all([
        mensalidadeService.getAll(true),
        mensalidadeService.getAll(false),
        mensalidadeService.getProximosVencimentos(3),
        mensalidadeService.getEstatisticas(),
        mensalidadeService.getPagamentos({ mes_referencia: mesReferencia }),
      ])
      const pagamentosMesList = pagamentosMes || []
      const pagamentosPorMensalidade = pagamentosMesList.reduce((acc, pagamento) => {
        const mid = pagamento?.mensalidade_id ?? pagamento?.mensalidadeId
        if (mid) acc[mid] = pagamento
        return acc
      }, {})
      setMensalidades(mensalidadesAtivasData)
      setMensalidadesInativas(mensalidadesInativasData)
      setPagamentosMesMap(pagamentosPorMensalidade)
      setProximosVencimentos(vencimentosData)
      setEstatisticas(statsData)
    } catch (error) {
      showToast(error.message || 'Erro ao carregar dados financeiros', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPacientes = async () => {
    try {
      const userRole = getUserRole()
      const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
      const data = isProfissional
        ? await profissionalService.getMyPacientes({ ativo: true })
        : await pacienteService.getAll({ ativo: true })
      setPacientes(Array.isArray(data) ? data : [])
    } catch {
      setPacientes([])
    }
  }

  const loadPagamentosCalendario = async (year, month) => {
    try {
      setLoadingCalendario(true)
      const mesRef = `${year}-${String(month).padStart(2, '0')}-01`
      const data = await mensalidadeService.getPagamentos({ mes_referencia: mesRef })
      setPagamentosCalendario(Array.isArray(data) ? data : [])
    } catch (error) {
      setPagamentosCalendario([])
      showToast(error.message || 'Erro ao carregar calendário', 'error')
    } finally {
      setLoadingCalendario(false)
    }
  }

  const getEventosPorDiaCalendario = (year, month) => {
    const lastDay = getDate(endOfMonth(new Date(year, month - 1, 1)))
    const mesRef = `${year}-${String(month).padStart(2, '0')}-01`
    const eventosPorData = {}
    const list = Array.isArray(mensalidades) ? mensalidades : []
    const pagamentos = Array.isArray(pagamentosCalendario) ? pagamentosCalendario : []
    for (const m of list) {
      const diaVen = Math.min(Number(m.dia_vencimento) || 1, lastDay)
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(diaVen).padStart(2, '0')}`
      const mId = m.id ? String(m.id) : ''
      const pagamento = pagamentos.find(p => {
        const pMid = String(p.mensalidade_id || p.mensalidadeId || '')
        const pMesRef = normalizeDateKey(p.mes_referencia)
        return pMid === mId && pMesRef === mesRef
      })
      const status = pagamento
        ? (String(pagamento.status || '').toLowerCase() === 'pago' ? 'pago' : 'pendente')
        : 'previsto'
      const evento = {
        id: pagamento?.id || `previsto-${m.id}-${dateKey}`,
        mensalidade_id: m.id,
        paciente_nome: m.paciente_nome || 'Paciente',
        valor_mensalidade: m.valor_mensalidade,
        valor_pago: pagamento != null ? (pagamento.valor_pago ?? pagamento.valor_mensalidade ?? m.valor_mensalidade) : m.valor_mensalidade,
        status,
        pagamento: pagamento || null,
        data_vencimento: dateKey,
      }
      if (!eventosPorData[dateKey]) eventosPorData[dateKey] = []
      eventosPorData[dateKey].push(evento)
    }
    return eventosPorData
  }

  const abrirModalMarcarPago = (pagamento) => {
    const valor = pagamento.valor_pago ?? pagamento.valor_mensalidade ?? 0
    setPagamentoParaPagar(pagamento)
    setValorPagoModal(String(valor))
    setMetodoPagamentoModal('pix')
    setObservacoesPagamentoModal(pagamento.observacoes || '')
  }

  const handleConfirmarMarcarPago = async (e) => {
    e.preventDefault()
    const paymentId = pagamentoParaPagar?.pagamento_id ?? pagamentoParaPagar?.id
    if (!paymentId) { showToast('ID do pagamento não encontrado', 'error'); return }
    const valor = parseFloat(valorPagoModal)
    if (Number.isNaN(valor) || valor <= 0) { showToast('Informe um valor válido', 'error'); return }
    try {
      await mensalidadeService.marcarPago(paymentId, {
        metodo_pagamento: metodoPagamentoModal,
        valor_pago: valor,
        observacoes: observacoesPagamentoModal.trim() || undefined,
      })
      showToast('Pagamento registrado com sucesso!')
      setPagamentoParaPagar(null)
      await loadData()
      if (abaAtiva === 'calendario') loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
      if (diaSelecionado) setDiaSelecionado(null)
    } catch (error) {
      showToast(error.message || 'Erro ao marcar pagamento', 'error')
    }
  }

  const handleSalvarStatusPagamento = async (mensalidade, status) => {
    const pagamentoMes = pagamentosMesMap[mensalidade.id]
    if (!pagamentoMes?.id) { showToast('Pagamento do mês atual não encontrado', 'error'); return }
    try {
      if (status === 'pago') {
        await mensalidadeService.marcarPago(pagamentoMes.id, {
          metodo_pagamento: 'pix',
          valor_pago: pagamentoMes.valor_pago || mensalidade.valor_mensalidade,
        })
      } else {
        await mensalidadeService.marcarPendente(pagamentoMes.id)
      }
      showToast(`Pagamento marcado como ${status === 'pago' ? 'pago' : 'pendente'}!`)
      await loadData()
      const { year, month } = getCurrentYearMonthBrazil()
      if (calendarioMesAno.year === year && calendarioMesAno.month === month) {
        await loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
      }
    } catch (error) {
      showToast(error.message || 'Erro ao salvar status', 'error')
    }
  }

  const handleEditarMensalidade = (mensalidade) => {
    setSelectedMensalidade(mensalidade)
    setShowModal(true)
  }

  const handleSalvarMensalidade = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const observacoes = formData.get('observacoes')?.toString().trim() || undefined
    try {
      if (selectedMensalidade?.id) {
        const novoDia = parseInt(formData.get('dia_vencimento'), 10)
        await mensalidadeService.update(selectedMensalidade.id, {
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: novoDia,
          observacoes,
        })
        const { year, month } = getCurrentYearMonthBrazil()
        const pagamentoMes = pagamentosMesMap[selectedMensalidade.id]
        if (pagamentoMes?.id) {
          const ultimoDia = getUltimoDiaMes(year, month)
          const diaAjustado = Math.min(novoDia, ultimoDia)
          const novaData = `${year}-${String(month).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`
          await mensalidadeService.alterarVencimento(pagamentoMes.id, novaData)
        }
        showToast('Mensalidade atualizada!')
      } else {
        await mensalidadeService.create({
          paciente_id: formData.get('paciente_id'),
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: parseInt(formData.get('dia_vencimento')),
          observacoes,
        })
        showToast('Mensalidade criada!')
      }
      setShowModal(false)
      setSelectedMensalidade(null)
      loadData()
    } catch (error) {
      showToast(error.message || 'Erro ao salvar mensalidade', 'error')
    }
  }

  const handleToggleAtivo = async (mensalidade) => {
    showConfirm(
      `Deseja ${mensalidade.ativo ? 'desativar' : 'ativar'} esta mensalidade?`,
      async () => {
        try {
          await mensalidadeService.update(mensalidade.id, { ativo: !mensalidade.ativo })
          showToast(`Mensalidade ${mensalidade.ativo ? 'desativada' : 'ativada'}!`)
          loadData()
        } catch (error) {
          showToast(error.message || 'Erro ao alterar status', 'error')
        }
      }
    )
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Acesso Negado</h2>
        <p className="text-neutral-600 mb-4">Você não tem permissão para acessar esta página.</p>
        <p className="text-sm text-neutral-500">Redirecionando...</p>
      </div>
    )
  }

  if (hasAccess === null || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Mensalidades</h1>
          <p className="page-subtitle">Gerencie cobranças mensais recorrentes dos pacientes</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {abaAtiva === 'ativas' && mensalidades.length > 0 && (
            <button
              onClick={async () => {
                try {
                  await mensalidadeService.gerarPagamentosMesAtual()
                  showToast('Pagamentos do mês gerados.')
                  loadData()
                } catch (err) {
                  showToast(err.message || 'Erro ao gerar pagamentos', 'error')
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors border border-neutral-200"
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Gerar pagamentos do mês</span>
            </button>
          )}
          <button
            onClick={() => { setSelectedMensalidade(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Nova Mensalidade</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-card border border-neutral-100 p-1.5 flex gap-1">
        {[
          { id: 'ativas', icon: Users, label: 'Ativas', count: mensalidades.length },
          { id: 'inativas', icon: Archive, label: 'Inativas', count: mensalidadesInativas.length },
          { id: 'calendario', icon: CalendarDays, label: 'Calendário', count: null },
        ].map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              abaAtiva === id ? 'bg-primary-500 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{label}</span>
              {count !== null && <span className="text-xs font-semibold opacity-70">({count})</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Estatísticas */}
      {abaAtiva === 'ativas' && estatisticas && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ativas', value: estatisticas.total_mensalidades_ativas, icon: Users, color: 'blue' },
            { label: 'Pendentes', value: estatisticas.total_pagamentos_pendentes, icon: Clock, color: 'yellow' },
            { label: 'Pendente R$', value: formatCurrency(estatisticas.valor_total_pendente), icon: AlertCircle, color: 'red', isText: true },
            { label: 'Recebido Mês', value: formatCurrency(estatisticas.valor_total_recebido_mes), icon: TrendingUp, color: 'green', isText: true },
          ].map(({ label, value, icon: Icon, color, isText }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 text-${color}-600`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-0.5 truncate">{label}</p>
                  <p className={`font-bold text-neutral-900 ${isText ? 'text-sm truncate' : 'text-xl'}`}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inativas info */}
      {abaAtiva === 'inativas' && (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="p-3 bg-neutral-100 rounded-lg">
              <Archive className="w-7 h-7 text-neutral-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Mensalidades Inativas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1 font-medium">Total Inativas</p>
                  <p className="text-2xl font-bold text-neutral-900">{mensalidadesInativas.length}</p>
                </div>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1 font-medium">Valor Total (mensal)</p>
                  <p className="text-xl font-bold text-neutral-900">
                    {formatCurrency(mensalidadesInativas.reduce((acc, m) => acc + (m.valor_mensalidade || 0), 0))}
                  </p>
                </div>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1 font-medium">Ações</p>
                  <p className="text-xs text-neutral-700">Reative mensalidades a qualquer momento.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendário */}
      {abaAtiva === 'calendario' && (
        <div className="bg-white rounded-2xl shadow-card border border-neutral-100 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalendarioMesAno(prev => {
                  const d = subMonths(new Date(prev.year, prev.month - 1, 1), 1)
                  return { year: d.getFullYear(), month: d.getMonth() + 1 }
                })}
                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-neutral-900 min-w-[200px] text-center">
                {format(new Date(calendarioMesAno.year, calendarioMesAno.month - 1, 1), 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <button
                type="button"
                onClick={() => setCalendarioMesAno(prev => {
                  const d = addMonths(new Date(prev.year, prev.month - 1, 1), 1)
                  return { year: d.getFullYear(), month: d.getMonth() + 1 }
                })}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> Pago</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Pendente</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-neutral-400" /> Previsto</span>
            </div>
          </div>

          {loadingCalendario ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-px mb-2 bg-neutral-200 rounded-t-lg overflow-hidden">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                  <div key={dia} className="bg-neutral-50 px-2 py-2 text-center text-xs font-semibold text-neutral-600 uppercase">{dia}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-b-lg overflow-hidden min-h-[320px]">
                {(() => {
                  const mesAtual = new Date(calendarioMesAno.year, calendarioMesAno.month - 1, 1)
                  const inicio = startOfMonth(mesAtual)
                  const fim = endOfMonth(mesAtual)
                  const diasDoMes = eachDayOfInterval({ start: inicio, end: fim })
                  const primeiroDiaSemana = getDay(inicio)
                  const celulasVaziasInicio = Array.from({ length: primeiroDiaSemana }, (_, i) => i)
                  const totalCelulas = 42
                  const celulasVaziasFim = Array.from({ length: Math.max(0, totalCelulas - primeiroDiaSemana - diasDoMes.length) }, (_, i) => i)
                  const eventosPorData = getEventosPorDiaCalendario(calendarioMesAno.year, calendarioMesAno.month)
                  const getEventosDoDia = (date) => eventosPorData[format(date, 'yyyy-MM-dd')] || []
                  const statusClass = (status) => {
                    if (status === 'pago') return 'bg-green-100 text-green-800'
                    if (status === 'pendente') return 'bg-amber-100 text-amber-800'
                    return 'bg-neutral-100 text-neutral-700'
                  }
                  return (
                    <>
                      {celulasVaziasInicio.map(i => <div key={`empty-${i}`} className="bg-neutral-50 min-h-[80px] sm:min-h-[100px]" />)}
                      {diasDoMes.map(dia => {
                        const eventosDia = getEventosDoDia(dia)
                        const hoje = isToday(dia)
                        return (
                          <div
                            key={dia.getTime()}
                            className={`bg-white min-h-[80px] sm:min-h-[100px] p-1.5 flex flex-col border-b border-r border-neutral-100 ${eventosDia.length > 0 ? 'cursor-pointer hover:bg-primary-50/50' : ''}`}
                            onClick={() => eventosDia.length > 0 && setDiaSelecionado({ date: dia, pagamentos: eventosDia })}
                          >
                            <span className={`text-sm font-medium mb-1 ${hoje ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-neutral-700'}`}>
                              {format(dia, 'd')}
                            </span>
                            <div className="flex-1 overflow-hidden space-y-0.5">
                              {eventosDia.slice(0, 3).map(ev => (
                                <div key={ev.id} className={`text-xs truncate px-1.5 py-0.5 rounded ${statusClass(ev.status)}`}>
                                  {ev.paciente_nome}
                                </div>
                              ))}
                              {eventosDia.length > 3 && <div className="text-xs text-neutral-500 px-1">+{eventosDia.length - 3}</div>}
                            </div>
                          </div>
                        )
                      })}
                      {celulasVaziasFim.map(i => <div key={`empty-end-${i}`} className="bg-neutral-50 min-h-[80px] sm:min-h-[100px]" />)}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal dia selecionado */}
      {diaSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDiaSelecionado(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">
                Vencimentos em {format(diaSelecionado.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <button onClick={() => setDiaSelecionado(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {diaSelecionado.pagamentos.map(ev => (
                <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50">
                  <div>
                    <p className="font-medium text-neutral-900">{ev.paciente_nome || 'Paciente'}</p>
                    <p className="text-sm text-neutral-600">{formatCurrency(ev.valor_pago || ev.valor_mensalidade)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${ev.status === 'pago' ? 'bg-green-100 text-green-800' : ev.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
                      {ev.status === 'pago' ? 'Pago' : ev.status === 'pendente' ? 'Pendente' : 'Previsto'}
                    </span>
                    {ev.status === 'pendente' && ev.pagamento && (
                      <button
                        onClick={() => abrirModalMarcarPago({ ...ev.pagamento, valor_pago: ev.pagamento.valor_pago ?? ev.valor_mensalidade, valor_mensalidade: ev.valor_mensalidade })}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                      >
                        Marcar Pago
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alertas de vencimento próximo */}
      {abaAtiva === 'ativas' && proximosVencimentosFromDia.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-sm animate-fade-in">
          <h3 className="flex items-center gap-2 text-yellow-900 font-semibold mb-4">
            <AlertCircle className="w-5 h-5" />
            Pagamentos Próximos do Vencimento
          </h3>
          <div className="space-y-3">
            {proximosVencimentosFromDia.map((venc) => (
              <div key={venc.pagamento_id} className="bg-white border border-yellow-100 p-4 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900">{venc.paciente_nome}</p>
                  <p className="text-sm text-neutral-600 mt-1">
                    Vence em {venc.dias_ate_vencimento} dia{venc.dias_ate_vencimento !== 1 ? 's' : ''} • {(() => {
                      const date = parseDateSafe(venc.data_vencimento)
                      return date ? date.toLocaleDateString('pt-BR') : '-'
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-lg text-neutral-900">{formatCurrency(venc.valor_pago)}</p>
                  <button
                    onClick={() => abrirModalMarcarPago({ ...venc, id: venc.pagamento_id })}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 whitespace-nowrap"
                  >
                    Marcar Pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Mensalidades */}
      {(abaAtiva === 'ativas' || abaAtiva === 'inativas') && (
        <div className="bg-white rounded-2xl shadow-card border border-neutral-100 overflow-hidden animate-fade-in">
          {/* Mobile */}
          <div className="block lg:hidden">
            {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <DollarSign className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <p className="font-medium">{abaAtiva === 'ativas' ? 'Nenhuma mensalidade ativa.' : 'Nenhuma mensalidade inativa.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).map((mensalidade) => {
                  const pagamentoMes = pagamentosMesMap[mensalidade.id]
                  const statusPagamento = pagamentoMes?.status || 'sem_pagamento'
                  const diasAteVencimento = getDiasAteVencimento(mensalidade)
                  const exibirLembrete = abaAtiva === 'ativas' && deveExibirLembrete(diasAteVencimento)
                  const corLembrete = getCorLembrete(diasAteVencimento)
                  return (
                    <div key={mensalidade.id} className={`p-4 space-y-3 ${exibirLembrete && statusPagamento !== 'pago' ? corLembrete + ' border border-t-0' : ''}`}>
                      {exibirLembrete && statusPagamento !== 'pago' && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm ${diasAteVencimento === 1 ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`}>
                          <Clock className="w-4 h-4" />
                          {diasAteVencimento === 1 ? 'Vence AMANHÃ!' : `Vence em ${diasAteVencimento} dias`}
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900">{mensalidade.paciente_nome}</h3>
                          <p className="text-sm text-neutral-600 mt-0.5">Vence todo dia {mensalidade.dia_vencimento}</p>
                        </div>
                        <p className="font-bold text-lg text-neutral-900">{formatCurrency(mensalidade.valor_mensalidade)}</p>
                      </div>
                      {abaAtiva === 'ativas' && (
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${statusPagamento === 'pago' ? 'bg-green-100 text-green-800' : statusPagamento === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-neutral-100 text-neutral-700'}`}>
                          {statusPagamento === 'sem_pagamento' ? 'Sem pagamento' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {abaAtiva === 'ativas' ? (
                          <>
                            <button onClick={() => handleEditarMensalidade(mensalidade)} className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100">
                              <Edit className="w-4 h-4" /> Editar
                            </button>
                            {statusPagamento !== 'sem_pagamento' && (
                              <>
                                <button
                                  onClick={() => pagamentoMes && abrirModalMarcarPago({ ...pagamentoMes, paciente_nome: mensalidade.paciente_nome, valor_pago: pagamentoMes.valor_pago ?? mensalidade.valor_mensalidade, valor_mensalidade: mensalidade.valor_mensalidade })}
                                  disabled={statusPagamento === 'pago'}
                                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-40"
                                >
                                  <CheckCircle className="w-4 h-4" /> Marcar pago
                                </button>
                                <button
                                  onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                                  disabled={statusPagamento !== 'pago'}
                                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 disabled:opacity-40"
                                >
                                  <Clock className="w-4 h-4" /> Voltar pendente
                                </button>
                              </>
                            )}
                            <button onClick={() => handleToggleAtivo(mensalidade)} className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                              <Archive className="w-4 h-4" /> Inativar
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditarMensalidade(mensalidade)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100">
                              <Edit className="w-4 h-4" /> Ver Detalhes
                            </button>
                            <button onClick={() => handleToggleAtivo(mensalidade)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                              <CheckCircle className="w-4 h-4" /> Reativar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Desktop */}
          <ResponsiveTable className="hidden lg:block">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Paciente</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Valor</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Vence dia</th>
                  {abaAtiva === 'ativas' && (
                    <>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Valor pago</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Método</th>
                    </>
                  )}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase max-w-[100px]">Obs.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-100">
                {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).map((mensalidade) => {
                  const pagamentoMes = pagamentosMesMap[mensalidade.id]
                  const statusPagamento = pagamentoMes?.status || 'sem_pagamento'
                  const diasAteVencimento = getDiasAteVencimento(mensalidade)
                  const exibirLembrete = abaAtiva === 'ativas' && deveExibirLembrete(diasAteVencimento)
                  return (
                    <tr key={mensalidade.id} className={`hover:bg-neutral-50 ${exibirLembrete && statusPagamento !== 'pago' ? diasAteVencimento === 1 ? 'bg-red-50 border-l-4 border-red-600' : 'bg-yellow-50 border-l-4 border-orange-600' : ''}`}>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {exibirLembrete && statusPagamento !== 'pago' && <Clock className={`w-4 h-4 flex-shrink-0 ${diasAteVencimento === 1 ? 'text-red-600' : 'text-orange-600'}`} />}
                          <span className="text-sm font-medium text-neutral-900 truncate max-w-[140px]">{mensalidade.paciente_nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-neutral-900">{formatCurrency(mensalidade.valor_mensalidade)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm text-neutral-700">Dia {mensalidade.dia_vencimento}</div>
                        {statusPagamento !== 'pago' && diasAteVencimento != null && <span className="text-xs text-neutral-500">{diasAteVencimento}d</span>}
                      </td>
                      {abaAtiva === 'ativas' && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusPagamento === 'pago' ? 'bg-green-100 text-green-800' : statusPagamento === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-neutral-100 text-neutral-700'}`}>
                              {statusPagamento === 'sem_pagamento' ? 'Sem pag.' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-900">
                            {statusPagamento === 'pago' && pagamentoMes?.valor_pago != null ? formatCurrency(pagamentoMes.valor_pago) : '-'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-600 capitalize">
                            {statusPagamento === 'pago' && pagamentoMes?.metodo_pagamento ? pagamentoMes.metodo_pagamento : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 text-sm text-neutral-600 max-w-[100px] truncate" title={mensalidade.observacoes || ''}>{mensalidade.observacoes || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-2">
                          {abaAtiva === 'ativas' ? (
                            <>
                              <button onClick={() => handleEditarMensalidade(mensalidade)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"><Edit className="w-4 h-4" /> Editar</button>
                              {statusPagamento === 'sem_pagamento' ? (
                                <button onClick={async () => { try { await mensalidadeService.gerarPagamentosMesAtual(); showToast('Pagamentos gerados.'); loadData() } catch (err) { showToast(err.message || 'Erro', 'error') } }} className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 font-medium"><Plus className="w-4 h-4" /> Gerar mês</button>
                              ) : (
                                <>
                                  <button onClick={() => pagamentoMes && abrirModalMarcarPago({ ...pagamentoMes, paciente_nome: mensalidade.paciente_nome, valor_pago: pagamentoMes.valor_pago ?? mensalidade.valor_mensalidade, valor_mensalidade: mensalidade.valor_mensalidade })} disabled={statusPagamento === 'pago'} className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:text-neutral-400 font-medium"><CheckCircle className="w-4 h-4" /> Marcar pago</button>
                                  <button onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')} disabled={statusPagamento !== 'pago'} className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1 disabled:text-neutral-400 font-medium"><Clock className="w-4 h-4" /> Voltar pendente</button>
                                </>
                              )}
                              <button onClick={() => handleToggleAtivo(mensalidade)} className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 font-medium"><Archive className="w-4 h-4" /> Inativar</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEditarMensalidade(mensalidade)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"><Edit className="w-4 h-4" /> Ver Detalhes</button>
                              <button onClick={() => handleToggleAtivo(mensalidade)} className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 font-medium"><CheckCircle className="w-4 h-4" /> Reativar</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <DollarSign className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <p className="font-medium">{abaAtiva === 'ativas' ? 'Nenhuma mensalidade ativa.' : 'Nenhuma mensalidade inativa.'}</p>
              </div>
            )}
          </ResponsiveTable>
        </div>
      )}

      {/* Modal Nova/Editar Mensalidade */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setSelectedMensalidade(null) }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">{selectedMensalidade ? 'Editar mensalidade' : 'Nova mensalidade'}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedMensalidade ? 'Altere valor, dia de vencimento e observações.' : 'Preencha os dados da mensalidade.'}</p>
              </div>
              <button onClick={() => { setShowModal(false); setSelectedMensalidade(null) }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={handleSalvarMensalidade} className="p-4 space-y-4 overflow-y-auto flex-1">
              {selectedMensalidade ? (
                <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
                  <p className="text-xs font-medium text-neutral-500">Paciente</p>
                  <p className="text-sm font-medium text-neutral-900">{selectedMensalidade.paciente_nome}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                  <select name="paciente_id" required className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">Selecione</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
                <input type="number" name="valor" step="0.01" min="0" placeholder="0,00" defaultValue={selectedMensalidade?.valor_mensalidade} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Dia do vencimento (1–31) <span className="text-red-500">*</span></label>
                <select name="dia_vencimento" defaultValue={selectedMensalidade?.dia_vencimento ?? 10} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
                <textarea name="observacoes" rows={2} defaultValue={selectedMensalidade?.observacoes} placeholder="Opcional" className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setSelectedMensalidade(null) }} className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50">Cancelar</button>
                <button type="submit" className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">{selectedMensalidade ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Marcar Pago */}
      {pagamentoParaPagar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPagamentoParaPagar(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Registrar pagamento</h2>
              <button onClick={() => setPagamentoParaPagar(null)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <form onSubmit={handleConfirmarMarcarPago} className="p-6 space-y-4">
              {pagamentoParaPagar.paciente_nome && (
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-600 font-medium">Paciente</p>
                  <p className="font-medium text-neutral-900">{pagamentoParaPagar.paciente_nome}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Valor pago (R$)</label>
                <input type="number" step="0.01" min="0" value={valorPagoModal} onChange={e => setValorPagoModal(e.target.value)} className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Método de pagamento</label>
                <select value={metodoPagamentoModal} onChange={e => setMetodoPagamentoModal(e.target.value)} className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                  {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Observações</label>
                <textarea value={observacoesPagamentoModal} onChange={e => setObservacoesPagamentoModal(e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none" placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPagamentoParaPagar(null)} className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700">Confirmar pagamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg w-full sm:min-w-[300px] sm:max-w-md ${toast.type === 'success' ? 'bg-green-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => setToast({ show: false, message: '', type: '' })} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-yellow-50 rounded-full"><AlertCircle className="w-6 h-6 text-yellow-600" /></div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">Confirmar Ação</h3>
                  <p className="text-sm text-neutral-600">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })} className="flex-1 px-4 py-2.5 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50">Cancelar</button>
                <button onClick={() => { confirmDialog.onConfirm?.(); setConfirmDialog({ show: false, message: '', onConfirm: null }) }} className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
