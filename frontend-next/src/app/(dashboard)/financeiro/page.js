'use client'
 
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { mensalidadeService } from '@/services/mensalidadeService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { pacoteService } from '@/services/pacoteService'
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
  Package,
  Trash2,
  Layers
} from 'lucide-react'
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, addMonths, subMonths, isSameMonth, isSameDay, isToday, getDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Função para formatar moeda no padrão brasileiro
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

// Normaliza qualquer valor de data para YYYY-MM-DD (para matching com API)
const normalizeDateKey = (val) => {
  if (val == null) return ''
  if (typeof val === 'string') return val.slice(0, 10)
  if (val instanceof Date) return format(val, 'yyyy-MM-dd')
  if (typeof val === 'object' && typeof val.toISOString === 'function') return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

// Coluna metodo_pagamento (pagamentos_mensalidades) — valores permitidos pelo backend
const METODOS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque', label: 'Cheque' }
]

export default function FinanceiroPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(null) // null = verificando, true = tem acesso, false = sem acesso
  const [mensalidades, setMensalidades] = useState([])
  const [mensalidadesInativas, setMensalidadesInativas] = useState([])
  const [pagamentosMesMap, setPagamentosMesMap] = useState({})
  const [proximosVencimentos, setProximosVencimentos] = useState([])
  const [estatisticas, setEstatisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedMensalidade, setSelectedMensalidade] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('ativas') // 'ativas' | 'inativas' | 'calendario'
  const [calendarioMesAno, setCalendarioMesAno] = useState(() => {
    const { year, month } = getCurrentYearMonthBrazil()
    return { year, month }
  })
  const [pagamentosCalendario, setPagamentosCalendario] = useState([])
  const [loadingCalendario, setLoadingCalendario] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState(null) // { date: Date, pagamentos: [] } para modal do dia
  
  // Modal Marcar Pago — campos da tabela pagamentos_mensalidades: valor_pago, metodo_pagamento, observacoes
  const [pagamentoParaPagar, setPagamentoParaPagar] = useState(null)
  const [valorPagoModal, setValorPagoModal] = useState('')
  const [metodoPagamentoModal, setMetodoPagamentoModal] = useState('pix')
  const [observacoesPagamentoModal, setObservacoesPagamentoModal] = useState('')
  
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null })

  // ── Pacotes ────────────────────────────────────────────────────────────────
  const [modalidade, setModalidade] = useState('mensalidades') // 'mensalidades' | 'pacotes'
  const [pacotesAbaAtiva, setPacotesAbaAtiva] = useState('ativos') // 'tipos' | 'ativos' | 'inativos'

  // Tipos de profissional
  const [tipos, setTipos] = useState([])
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [showModalTipo, setShowModalTipo] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState(null)
  const [tipoNome, setTipoNome] = useState('')
  const [tipoValor, setTipoValor] = useState('')

  // Pacotes por paciente
  const [pacotesAtivos, setPacotesAtivos] = useState([])
  const [pacotesInativos, setPacotesInativos] = useState([])
  const [loadingPacotes, setLoadingPacotes] = useState(false)
  const [estatisticasPacotes, setEstatisticasPacotes] = useState(null)

  // Pagamentos de pacotes do mês
  const [pagamentosPacotesMesMap, setPagamentosPacotesMesMap] = useState({})

  // Modal criar/editar pacote
  const [showModalPacote, setShowModalPacote] = useState(false)
  const [selectedPacote, setSelectedPacote] = useState(null)
  const [pacoteItens, setPacoteItens] = useState([]) // [{ tipo_profissional_id, quantidade }]
  const [pacoteDiaVencimento, setPacoteDiaVencimento] = useState(10)
  const [pacoteObservacoes, setPacoteObservacoes] = useState('')
  const [pacotePacienteId, setPacotePacienteId] = useState('')

  // Modal marcar pago (pacotes) – reutiliza mesmos campos do modal de mensalidades
  const [pagamentoPacoteParaPagar, setPagamentoPacoteParaPagar] = useState(null)
  const [valorPagoPacoteModal, setValorPagoPacoteModal] = useState('')
  const [metodoPagamentoPacoteModal, setMetodoPagamentoPacoteModal] = useState('pix')
  const [observacoesPagamentoPacoteModal, setObservacoesPagamentoPacoteModal] = useState('')

  // Verificar permissão de acesso
  useEffect(() => {
    const userRole = getUserRole()
    const canAccess = canAccessModule(userRole, 'financeiro')
    setHasAccess(canAccess)
    
    if (!canAccess && userRole) {
      // Redirecionar após 2 segundos para mostrar a mensagem de erro
      const timeout = setTimeout(() => {
        router.push('/pacientes')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [router])

  // Função para mostrar toast
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  // Função para mostrar confirmação
  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm })
  }

  // Retorna o último dia do mês para um dado ano/mês (28-31)
  const getUltimoDiaMes = (year, month) => new Date(year, month, 0).getDate()

  // Função para calcular dias até vencimento (baseado apenas no dia do mês, 1-31)
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

    const diff = vencimento - hoje
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // Função para verificar se deve mostrar lembrete (2-3 dias antes)
  const deveExibirLembrete = (dias) => {
    return dias !== null && dias > 0 && dias <= 3
  }

  // Próximos vencimentos com base em dia_vencimento da mensalidade (não em data_vencimento do pagamento)
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
        dias_ate_vencimento: dias
      })
    }
    return list.sort((a, b) => a.dias_ate_vencimento - b.dias_ate_vencimento)
  })()

  // Função para obter coragem do lembrete
  const getCorLembrete = (dias) => {
    if (!dias || dias <= 0) return null
    if (dias === 1) return 'bg-red-50 border-red-200'
    return 'bg-yellow-50 border-yellow-200'
  }

  useEffect(() => {
    // Só carregar dados se o usuário tiver acesso
    if (hasAccess === true) {
      loadData()
      loadPacientes()
    }
  }, [hasAccess])

  // Carregar pagamentos do mês quando estiver na aba Calendário ou mudar mês
  useEffect(() => {
    if (hasAccess === true && abaAtiva === 'calendario') {
      loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
    }
  }, [hasAccess, abaAtiva, calendarioMesAno.year, calendarioMesAno.month])

  // Carregar dados de pacotes quando modalidade for pacotes
  useEffect(() => {
    if (hasAccess === true && modalidade === 'pacotes') {
      loadTipos()
      loadPacotesData()
    }
  }, [hasAccess, modalidade])

  const loadData = async () => {
    try {
      setLoading(true)
      const mesReferencia = getFirstDayOfMonthBrazil()

      const [mensalidadesAtivasData, mensalidadesInativasData, vencimentosData, statsData, pagamentosMes] = await Promise.all([
        mensalidadeService.getAll(true),
        mensalidadeService.getAll(false),
        mensalidadeService.getProximosVencimentos(3),
        mensalidadeService.getEstatisticas(),
        mensalidadeService.getPagamentos({ mes_referencia: mesReferencia })
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
      console.error('Erro ao carregar dados:', error)
      const mensagem = error.message || 'Erro ao carregar dados financeiros'
      showToast(mensagem, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPacientes = async () => {
    try {
      const userRole = getUserRole()
      const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
      
      let data
      if (isProfissional) {
        data = await profissionalService.getMyPacientes({ ativo: true })
      } else {
        data = await pacienteService.getAll({ ativo: true })
      }
      
      console.log('Pacientes carregados:', data)
      setPacientes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error)
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
      console.error('Erro ao carregar pagamentos do calendário:', error)
      setPagamentosCalendario([])
      showToast(error.message || 'Erro ao carregar calendário', 'error')
    } finally {
      setLoadingCalendario(false)
    }
  }

  /**
   * Constrói os eventos do calendário com base em dia_vencimento da mensalidade (não em data_vencimento do pagamento).
   * O dia do evento é sempre (ano, mês, dia_vencimento). O pagamento do mês é encontrado por mensalidade_id + mes_referencia.
   */
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
      const status = pagamento ? (String(pagamento.status || '').toLowerCase() === 'pago' ? 'pago' : 'pendente') : 'previsto'
      const evento = {
        id: pagamento?.id || `previsto-${m.id}-${dateKey}`,
        mensalidade_id: m.id,
        paciente_nome: m.paciente_nome || 'Paciente',
        valor_mensalidade: m.valor_mensalidade,
        valor_pago: pagamento != null ? (pagamento.valor_pago ?? pagamento.valor_mensalidade ?? m.valor_mensalidade) : m.valor_mensalidade,
        status,
        pagamento: pagamento || null,
        data_vencimento: dateKey
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
    if (!paymentId) {
      showToast('ID do pagamento não encontrado', 'error')
      return
    }
    const valor = parseFloat(valorPagoModal)
    if (Number.isNaN(valor) || valor <= 0) {
      showToast('Informe um valor válido', 'error')
      return
    }
    try {
      await mensalidadeService.marcarPago(paymentId, {
        metodo_pagamento: metodoPagamentoModal,
        valor_pago: valor,
        observacoes: observacoesPagamentoModal.trim() || undefined
      })
      showToast('Pagamento registrado com sucesso!', 'success')
      setPagamentoParaPagar(null)
      await loadData()
      if (abaAtiva === 'calendario') loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
      if (diaSelecionado) setDiaSelecionado(null)
    } catch (error) {
      console.error('Erro:', error)
      showToast(error.message || 'Erro ao marcar pagamento', 'error')
    }
  }

  const handleSalvarStatusPagamento = async (mensalidade, status) => {
    const pagamentoMes = pagamentosMesMap[mensalidade.id]

    if (!pagamentoMes?.id) {
      showToast('Pagamento do mês atual não encontrado', 'error')
      return
    }

    try {
      if (status === 'pago') {
        await mensalidadeService.marcarPago(pagamentoMes.id, {
          metodo_pagamento: 'pix',
          valor_pago: pagamentoMes.valor_pago || mensalidade.valor_mensalidade
        })
      } else {
        await mensalidadeService.marcarPendente(pagamentoMes.id)
      }

      showToast(`Pagamento marcado como ${status === 'pago' ? 'pago' : 'pendente'}!`, 'success')
      await loadData()
      // Atualiza o calendário se estiver no mês atual para refletir o novo status
      const { year, month } = getCurrentYearMonthBrazil()
      if (calendarioMesAno.year === year && calendarioMesAno.month === month) {
        await loadPagamentosCalendario(calendarioMesAno.year, calendarioMesAno.month)
      }
    } catch (error) {
      console.error('Erro:', error)
      const mensagem = error.message || 'Erro ao salvar status do pagamento'
      showToast(mensagem, 'error')
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
          observacoes
        })
        const { year, month } = getCurrentYearMonthBrazil()
        const pagamentoMes = pagamentosMesMap[selectedMensalidade.id]
        if (pagamentoMes?.id) {
          const ultimoDia = getUltimoDiaMes(year, month)
          const diaAjustado = Math.min(novoDia, ultimoDia)
          const novaData = `${year}-${String(month).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`
          await mensalidadeService.alterarVencimento(pagamentoMes.id, novaData)
        }
        showToast('Mensalidade atualizada com sucesso!', 'success')
      } else {
        await mensalidadeService.create({
          paciente_id: formData.get('paciente_id'),
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: parseInt(formData.get('dia_vencimento')),
          observacoes
        })
        showToast('Mensalidade criada com sucesso!', 'success')
      }
      
      setShowModal(false)
      setSelectedMensalidade(null)
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      const mensagem = error.message || 'Erro ao salvar mensalidade'
      showToast(mensagem, 'error')
    }
  }

  const handleToggleAtivo = async (mensalidade) => {
    showConfirm(
      `Deseja ${mensalidade.ativo ? 'desativar' : 'ativar'} esta mensalidade?`,
      async () => {
        try {
          await mensalidadeService.update(mensalidade.id, {
            ativo: !mensalidade.ativo
          })
          showToast(`Mensalidade ${mensalidade.ativo ? 'desativada' : 'ativada'} com sucesso!`, 'success')
          loadData()
        } catch (error) {
          console.error('Erro:', error)
          const mensagem = error.message || 'Erro ao alterar status'
          showToast(mensagem, 'error')
        }
      }
    )
  }

  // ── FUNÇÕES DE PACOTES ──────────────────────────────────────────────────────

  const loadTipos = async () => {
    try {
      setLoadingTipos(true)
      const data = await pacoteService.getTipos()
      setTipos(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar tipos:', error)
      showToast(error.message || 'Erro ao carregar tipos de profissional', 'error')
    } finally {
      setLoadingTipos(false)
    }
  }

  const loadPacotesData = async () => {
    try {
      setLoadingPacotes(true)
      const mesReferencia = getFirstDayOfMonthBrazil()
      const [ativosRes, inativosRes, statsRes, pagsMesRes] = await Promise.allSettled([
        pacoteService.getAll(true),
        pacoteService.getAll(false),
        pacoteService.getEstatisticas(),
        pacoteService.getPagamentos({ mes_referencia: mesReferencia }),
      ])

      // Extrai resultado ou fallback seguro para cada chamada
      const ativos  = ativosRes.status   === 'fulfilled' ? ativosRes.value   : []
      const inativos = inativosRes.status === 'fulfilled' ? inativosRes.value : []
      const stats   = statsRes.status    === 'fulfilled' ? statsRes.value    : null
      const pagsMes = pagsMesRes.status  === 'fulfilled' ? pagsMesRes.value  : []

      // Loga erros individuais sem quebrar o carregamento
      if (ativosRes.status  === 'rejected') console.error('Erro ao buscar pacotes ativos:',   ativosRes.reason)
      if (inativosRes.status === 'rejected') console.error('Erro ao buscar pacotes inativos:', inativosRes.reason)
      if (statsRes.status   === 'rejected') console.error('Erro ao buscar estatísticas:',      statsRes.reason)
      if (pagsMesRes.status === 'rejected') console.error('Erro ao buscar pagamentos do mês:', pagsMesRes.reason)

      setPacotesAtivos(Array.isArray(ativos) ? ativos : [])
      setPacotesInativos(Array.isArray(inativos) ? inativos : [])
      setEstatisticasPacotes(stats)
      const pagsPorPacote = (Array.isArray(pagsMes) ? pagsMes : []).reduce((acc, p) => {
        if (p?.pacote_id) acc[p.pacote_id] = p
        return acc
      }, {})
      setPagamentosPacotesMesMap(pagsPorPacote)

      // Só exibe toast se o carregamento principal (ativos) falhou
      if (ativosRes.status === 'rejected') {
        showToast(ativosRes.reason?.message || 'Erro ao carregar pacotes', 'error')
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar pacotes:', error)
      showToast(error.message || 'Erro ao carregar pacotes', 'error')
    } finally {
      setLoadingPacotes(false)
    }
  }

  const handleAbrirModalTipo = (tipo = null) => {
    setSelectedTipo(tipo)
    setTipoNome(tipo?.nome || '')
    setTipoValor(tipo?.valor_mensal != null ? String(tipo.valor_mensal) : '')
    setShowModalTipo(true)
  }

  const handleSalvarTipo = async (e) => {
    e.preventDefault()
    const valor = parseFloat(tipoValor)
    if (!tipoNome.trim() || isNaN(valor) || valor <= 0) {
      showToast('Preencha nome e valor válido', 'error')
      return
    }
    try {
      if (selectedTipo?.id) {
        await pacoteService.updateTipo(selectedTipo.id, { nome: tipoNome.trim(), valor_mensal: valor })
        showToast('Tipo atualizado com sucesso!', 'success')
      } else {
        await pacoteService.createTipo({ nome: tipoNome.trim(), valor_mensal: valor })
        showToast('Tipo criado com sucesso!', 'success')
      }
      setShowModalTipo(false)
      loadTipos()
    } catch (error) {
      showToast(error.message || 'Erro ao salvar tipo', 'error')
    }
  }

  const handleExcluirTipo = (tipo) => {
    showConfirm(
      `Excluir permanentemente o tipo "${tipo.nome}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await pacoteService.deleteTipo(tipo.id)
          showToast('Tipo excluído!', 'success')
          loadTipos()
        } catch (error) {
          showToast(error.message || 'Erro ao excluir tipo', 'error')
        }
      }
    )
  }

  const handleAbrirModalPacote = (pacote = null) => {
    setSelectedPacote(pacote)
    setPacotePacienteId(pacote?.paciente_id || '')
    setPacoteDiaVencimento(pacote?.dia_vencimento || 10)
    setPacoteObservacoes(pacote?.observacoes || '')
    // Preserva o valor_mensal salvo no item (snapshot histórico) para exibição
    setPacoteItens(pacote?.itens?.map(it => ({
      tipo_profissional_id: it.tipo_profissional_id,
      quantidade: it.quantidade || 1,
      valor_mensal_snapshot: it.valor_mensal ?? null, // preço fixado ao criar/editar
    })) || [])
    setShowModalPacote(true)
  }

  const calcularValorTotalItens = () => {
    // Para itens já existentes no pacote: usa o preço salvo (snapshot)
    // Para itens recém adicionados no modal: usa o preço atual do tipo
    return pacoteItens.reduce((acc, item) => {
      const vm = item.valor_mensal_snapshot != null
        ? parseFloat(item.valor_mensal_snapshot)
        : parseFloat(tipos.find(t => t.id === item.tipo_profissional_id)?.valor_mensal || 0)
      return acc + vm * (item.quantidade || 1)
    }, 0)
  }

  const handleToggleItemPacote = (tipoId) => {
    const exists = pacoteItens.find(it => it.tipo_profissional_id === tipoId)
    if (exists) {
      setPacoteItens(prev => prev.filter(it => it.tipo_profissional_id !== tipoId))
    } else {
      // Novo item adicionado: sem snapshot (será fixado pelo backend ao salvar)
      setPacoteItens(prev => [...prev, { tipo_profissional_id: tipoId, quantidade: 1, valor_mensal_snapshot: null }])
    }
  }

  const handleAlterarQuantidadeItem = (tipoId, quantidade) => {
    const qt = Math.max(1, parseInt(quantidade) || 1)
    setPacoteItens(prev => prev.map(it =>
      it.tipo_profissional_id === tipoId ? { ...it, quantidade: qt } : it
    ))
  }

  const handleSalvarPacote = async (e) => {
    e.preventDefault()
    if (!pacoteItens.length) {
      showToast('Adicione ao menos um tipo de profissional ao pacote', 'error')
      return
    }
    try {
      if (selectedPacote?.id) {
        await pacoteService.update(selectedPacote.id, {
          dia_vencimento: pacoteDiaVencimento,
          observacoes: pacoteObservacoes.trim() || undefined,
          itens: pacoteItens,
        })
        showToast('Pacote atualizado!', 'success')
      } else {
        await pacoteService.create({
          paciente_id: pacotePacienteId,
          dia_vencimento: pacoteDiaVencimento,
          observacoes: pacoteObservacoes.trim() || undefined,
          itens: pacoteItens,
        })
        showToast('Pacote criado!', 'success')
      }
      setShowModalPacote(false)
      loadPacotesData()
    } catch (error) {
      showToast(error.message || 'Erro ao salvar pacote', 'error')
    }
  }

  const handleToggleAtivoPacote = (pacote) => {
    showConfirm(
      `Deseja ${pacote.ativo ? 'desativar' : 'ativar'} o pacote de ${pacote.paciente_nome}?`,
      async () => {
        try {
          await pacoteService.update(pacote.id, { ativo: !pacote.ativo })
          showToast(`Pacote ${pacote.ativo ? 'desativado' : 'ativado'}!`, 'success')
          loadPacotesData()
        } catch (error) {
          showToast(error.message || 'Erro ao alterar pacote', 'error')
        }
      }
    )
  }

  const abrirModalMarcarPagoPacote = (pagamento) => {
    const valor = pagamento.valor_pago ?? 0
    setPagamentoPacoteParaPagar(pagamento)
    setValorPagoPacoteModal(String(valor))
    setMetodoPagamentoPacoteModal('pix')
    setObservacoesPagamentoPacoteModal(pagamento.observacoes || '')
  }

  const handleConfirmarMarcarPagoPacote = async (e) => {
    e.preventDefault()
    const paymentId = pagamentoPacoteParaPagar?.id
    if (!paymentId) return
    const valor = parseFloat(valorPagoPacoteModal)
    if (isNaN(valor) || valor <= 0) {
      showToast('Informe um valor válido', 'error')
      return
    }
    try {
      await pacoteService.marcarPago(paymentId, {
        metodo_pagamento: metodoPagamentoPacoteModal,
        valor_pago: valor,
        observacoes: observacoesPagamentoPacoteModal.trim() || undefined,
      })
      showToast('Pagamento registrado!', 'success')
      setPagamentoPacoteParaPagar(null)
      loadPacotesData()
    } catch (error) {
      showToast(error.message || 'Erro ao registrar pagamento', 'error')
    }
  }

  const handleMarcarPendentePacote = async (pagamento) => {
    showConfirm('Marcar pagamento como pendente?', async () => {
      try {
        await pacoteService.marcarPendente(pagamento.id)
        showToast('Pagamento marcado como pendente!', 'success')
        loadPacotesData()
      } catch (error) {
        showToast(error.message || 'Erro ao marcar pendente', 'error')
      }
    })
  }

  // Verificação de acesso - mostrar tela de erro se não autorizado
  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Acesso Negado</h2>
        <p className="text-neutral-600 mb-4">
          Você não tem permissão para acessar esta página.
        </p>
        <p className="text-sm text-neutral-500">Redirecionando...</p>
      </div>
    )
  }

  // Aguardando verificação de acesso
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Financeiro</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie mensalidades e pacotes de profissionais</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {modalidade === 'mensalidades' && abaAtiva === 'ativas' && mensalidades.length > 0 && (
            <button
              onClick={async () => {
                try {
                  await mensalidadeService.gerarPagamentosMesAtual()
                  showToast('Pagamentos do mês gerados.', 'success')
                  loadData()
                } catch (err) {
                  showToast(err.message || 'Erro ao gerar pagamentos', 'error')
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors border border-neutral-200"
              title="Gerar pagamentos do mês"
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Gerar pagamentos do mês</span>
            </button>
          )}
          {modalidade === 'pacotes' && pacotesAbaAtiva === 'tipos' && (
            <button
              onClick={() => handleAbrirModalTipo()}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Tipo</span>
            </button>
          )}
          {modalidade === 'pacotes' && (pacotesAbaAtiva === 'ativos' || pacotesAbaAtiva === 'inativos') && (
            <button
              onClick={async () => {
                try {
                  await pacoteService.gerarPagamentosMesAtual()
                  showToast('Pagamentos do mês gerados.', 'success')
                  loadPacotesData()
                } catch (err) {
                  showToast(err.message || 'Erro ao gerar pagamentos', 'error')
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors border border-neutral-200"
              title="Gerar pagamentos do mês"
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Gerar pagamentos do mês</span>
            </button>
          )}
          {modalidade === 'pacotes' && pacotesAbaAtiva === 'ativos' && (
            <button
              onClick={() => handleAbrirModalPacote()}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Pacote</span>
            </button>
          )}
          <button
            onClick={() => {
              setSelectedMensalidade(null)
              setShowModal(true)
            }}
            className={`flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm ${modalidade === 'pacotes' ? 'hidden' : ''}`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Nova Mensalidade</span>
          </button>
        </div>
      </div>

        {/* Seletor de Modalidade */}
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1 border border-neutral-100">
          {[
            { id: 'mensalidades', label: 'Mensalidades', icon: DollarSign },
            { id: 'pacotes', label: 'Pacotes', icon: Package },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setModalidade(id)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                modalidade === id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* ── MODALIDADE MENSALIDADES ────────────────────────────────────────── */}
        {modalidade === 'mensalidades' && (<>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
          {[
            { id: 'ativas', icon: Users, label: 'Ativas', count: mensalidades.length },
            { id: 'inativas', icon: Archive, label: 'Inativas', count: mensalidadesInativas.length },
            { id: 'calendario', icon: CalendarDays, label: 'Calendário', count: null },
          ].map(({ id, icon: Icon, label, count }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id)}
              className={`flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
                abaAtiva === id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
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

        {/* Estatísticas - Apenas para aba ativas */}
        {abaAtiva === 'ativas' && estatisticas && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500 mb-0.5 truncate">Ativas</p>
                  <p className="text-xl font-bold text-neutral-900">{estatisticas.total_mensalidades_ativas}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-yellow-50 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500 mb-0.5 truncate">Pendentes</p>
                  <p className="text-xl font-bold text-neutral-900">{estatisticas.total_pagamentos_pendentes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500 mb-0.5 truncate">Pendente R$</p>
                  <p className="text-sm font-bold text-neutral-900 truncate">
                    {formatCurrency(estatisticas.valor_total_pendente)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500 mb-0.5 truncate">Recebido Mês</p>
                  <p className="text-sm font-bold text-neutral-900 truncate">
                    {formatCurrency(estatisticas.valor_total_recebido_mes)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card informativo para mensalidades inativas */}
        {abaAtiva === 'inativas' && (
          <div className="bg-white border border-neutral-200 rounded-lg p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-neutral-100 rounded-lg">
                <Archive className="w-7 h-7 text-neutral-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  Mensalidades Inativas
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Mensalidades desativadas quando um paciente para o tratamento ou não há mais necessidade de cobrança recorrente.
                </p>
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
                    <p className="text-xs text-neutral-700">
                      Reative mensalidades a qualquer momento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendário de Mensalidades */}
        {abaAtiva === 'calendario' && (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarioMesAno(prev => {
                    const d = subMonths(new Date(prev.year, prev.month - 1, 1), 1)
                    return { year: d.getFullYear(), month: d.getMonth() + 1 }
                  })}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors"
                  aria-label="Mês anterior"
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
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Pago
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" /> Pendente
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-neutral-400" /> Previsto
                </span>
              </div>
            </div>

            {loadingCalendario ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : (
              <div className="p-4">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 gap-px mb-2 bg-neutral-200 rounded-t-lg overflow-hidden">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                    <div key={dia} className="bg-neutral-50 px-2 py-2 text-center text-xs font-semibold text-neutral-600 uppercase">
                      {dia}
                    </div>
                  ))}
                </div>
                {/* Grid do mês - eventos derivados das mensalidades ativas (qualquer mês) */}
                <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-b-lg overflow-hidden min-h-[320px]">
                  {(() => {
                    const mesAtual = new Date(calendarioMesAno.year, calendarioMesAno.month - 1, 1)
                    const inicio = startOfMonth(mesAtual)
                    const fim = endOfMonth(mesAtual)
                    const diasDoMes = eachDayOfInterval({ start: inicio, end: fim })
                    const primeiroDiaSemana = getDay(inicio) // 0 = Domingo
                    const celulasVaziasInicio = Array.from({ length: primeiroDiaSemana }, (_, i) => i)
                    const totalCelulas = 42
                    const celulasRestantes = totalCelulas - primeiroDiaSemana - diasDoMes.length
                    const celulasVaziasFim = Array.from({ length: Math.max(0, celulasRestantes) }, (_, i) => i)
                    const eventosPorData = getEventosPorDiaCalendario(calendarioMesAno.year, calendarioMesAno.month)

                    const getEventosDoDia = (date) => {
                      const key = format(date, 'yyyy-MM-dd')
                      return eventosPorData[key] || []
                    }

                    const statusClass = (status) => {
                      if (status === 'pago') return 'bg-green-100 text-green-800'
                      if (status === 'pendente') return 'bg-amber-100 text-amber-800'
                      return 'bg-neutral-100 text-neutral-700'
                    }

                    return (
                      <>
                        {celulasVaziasInicio.map(i => (
                          <div key={`empty-${i}`} className="bg-neutral-50 min-h-[80px] sm:min-h-[100px]" />
                        ))}
                        {diasDoMes.map(dia => {
                          const eventosDia = getEventosDoDia(dia)
                          const hoje = isToday(dia)
                          return (
                            <div
                              key={dia.getTime()}
                              className={`bg-white min-h-[80px] sm:min-h-[100px] p-1.5 flex flex-col border-b border-r border-neutral-100 last:border-r-0 ${
                                !isSameMonth(dia, mesAtual) ? 'opacity-50' : ''
                              } ${eventosDia.length > 0 ? 'cursor-pointer hover:bg-primary-50/50' : ''}`}
                              onClick={() => eventosDia.length > 0 && setDiaSelecionado({ date: dia, pagamentos: eventosDia })}
                            >
                              <span className={`text-sm font-medium mb-1 ${
                                hoje ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-neutral-700'
                              }`}>
                                {format(dia, 'd')}
                              </span>
                              <div className="flex-1 overflow-hidden space-y-0.5">
                                {eventosDia.slice(0, 3).map(ev => (
                                  <div
                                    key={ev.id}
                                    className={`text-xs truncate px-1.5 py-0.5 rounded ${statusClass(ev.status)}`}
                                    title={`${ev.paciente_nome} - ${formatCurrency(ev.valor_pago || ev.valor_mensalidade)} - ${ev.status === 'pago' ? 'Pago' : ev.status === 'pendente' ? 'Pendente' : 'Previsto'}`}
                                  >
                                    {ev.paciente_nome}
                                  </div>
                                ))}
                                {eventosDia.length > 3 && (
                                  <div className="text-xs text-neutral-500 px-1">+{eventosDia.length - 3}</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {celulasVaziasFim.map(i => (
                          <div key={`empty-end-${i}`} className="bg-neutral-50 min-h-[80px] sm:min-h-[100px]" />
                        ))}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal do dia selecionado no calendário */}
        {diaSelecionado && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setDiaSelecionado(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-900">
                  Vencimentos em {format(diaSelecionado.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <button
                  onClick={() => setDiaSelecionado(null)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
                {diaSelecionado.pagamentos.map(ev => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">{ev.paciente_nome || 'Paciente'}</p>
                      <p className="text-sm text-neutral-600">{formatCurrency(ev.valor_pago || ev.valor_mensalidade)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        ev.status === 'pago' ? 'bg-green-100 text-green-800' : ev.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {ev.status === 'pago' ? 'Pago' : ev.status === 'pendente' ? 'Pendente' : 'Previsto'}
                      </span>
                      {ev.status === 'pendente' && ev.pagamento && (
                        <button
                          onClick={() => abrirModalMarcarPago({
                            ...ev.pagamento,
                            id: ev.pagamento.id,
                            valor_pago: ev.pagamento.valor_pago ?? ev.valor_mensalidade,
                            valor_mensalidade: ev.valor_mensalidade
                          })}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                        >
                          Marcar Pago
                        </button>
                      )}
                      {ev.status === 'previsto' && (
                        <span className="text-xs text-neutral-500">Pagamento gerado no mês do vencimento</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alertas de Vencimento — baseado em dia_vencimento da mensalidade (próximos 3 dias) */}
        {abaAtiva === 'ativas' && proximosVencimentosFromDia.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-yellow-900 font-semibold mb-4">
              <AlertCircle className="w-5 h-5" />
              Pagamentos Próximos do Vencimento
              <span className="text-sm font-normal text-yellow-700">(dia_vencimento — próximos 3 dias)</span>
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
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                      Marcar Pago
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Mensalidades (mensalidades_pacientes) — oculta em Calendário e Pagamentos */}
        {(abaAtiva === 'ativas' || abaAtiva === 'inativas') && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
          {/* Mobile View - Cards */}
          <div className="block lg:hidden">
            {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <div className="mb-3">
                  <DollarSign className="w-12 h-12 mx-auto text-neutral-300" />
                </div>
                <p className="font-medium">
                  {abaAtiva === 'ativas' 
                    ? 'Nenhuma mensalidade ativa encontrada.'
                    : 'Nenhuma mensalidade inativa encontrada.'
                  }
                </p>
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
                    <div 
                      key={mensalidade.id} 
                      className={`p-4 space-y-3 ${exibirLembrete && statusPagamento !== 'pago' ? corLembrete + ' border border-t-0' : ''}`}
                    >
                      {/* Badge de Lembrete */}
                      {exibirLembrete && statusPagamento !== 'pago' && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm ${
                          diasAteVencimento === 1
                            ? 'bg-red-600 text-white'
                            : 'bg-orange-600 text-white'
                        }`}>
                          <Clock className="w-4 h-4" />
                          {diasAteVencimento === 1 
                            ? 'Vence AMANHÃ!' 
                            : ` Vence em ${diasAteVencimento} dias`
                          }
                        </div>
                      )}

                      {/* Cabeçalho do Card */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900">{mensalidade.paciente_nome}</h3>
                          <div className="text-sm text-neutral-600 mt-0.5 space-y-0.5">
                            <p>Vence todo dia {mensalidade.dia_vencimento}</p>
                            {statusPagamento !== 'pago' && diasAteVencimento !== null && (
                              <p className="text-xs text-neutral-500">({diasAteVencimento} dia{diasAteVencimento !== 1 ? 's' : ''} para vencer)</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-neutral-900">{formatCurrency(mensalidade.valor_mensalidade)}</p>
                        </div>
                      </div>

                      {/* Status e dados do pagamento (quando pago) */}
                      {abaAtiva === 'ativas' && (
                        <div className="space-y-1">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            statusPagamento === 'pago'
                              ? 'bg-green-100 text-green-800'
                              : statusPagamento === 'pendente'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {statusPagamento === 'sem_pagamento' ? 'Sem pagamento' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                          </span>
                          {statusPagamento === 'pago' && pagamentoMes && (
                            <div className="text-xs text-neutral-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-neutral-100">
                              <span>{formatCurrency(pagamentoMes.valor_pago)}</span>
                              {pagamentoMes.metodo_pagamento && <span className="capitalize">{pagamentoMes.metodo_pagamento}</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {abaAtiva === 'inativas' && mensalidade.observacoes && (
                        <div className="text-sm text-neutral-600 truncate max-w-full" title={mensalidade.observacoes}>
                          {mensalidade.observacoes}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {abaAtiva === 'ativas' ? (
                          <>
                            <button
                              onClick={() => handleEditarMensalidade(mensalidade)}
                              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </button>
                            {statusPagamento === 'sem_pagamento' ? (
                              <button
                                onClick={async () => {
                                  try {
                                    await mensalidadeService.gerarPagamentosMesAtual()
                                    showToast('Pagamentos do mês gerados.', 'success')
                                    loadData()
                                  } catch (err) {
                                    showToast(err.message || 'Erro ao gerar pagamentos', 'error')
                                  }
                                }}
                                className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Gerar mês
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => pagamentoMes && abrirModalMarcarPago({
                                    ...pagamentoMes,
                                    id: pagamentoMes.id,
                                    paciente_nome: mensalidade.paciente_nome,
                                    valor_pago: pagamentoMes.valor_pago ?? mensalidade.valor_mensalidade,
                                    valor_mensalidade: mensalidade.valor_mensalidade
                                  })}
                                  disabled={statusPagamento === 'pago'}
                                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Marcar pago
                                </button>
                                <button
                                  onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                                  disabled={statusPagamento !== 'pago'}
                                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-50"
                                >
                                  <Clock className="w-4 h-4" />
                                  Voltar pendente
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleToggleAtivo(mensalidade)}
                              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <Archive className="w-4 h-4" />
                              Inativar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditarMensalidade(mensalidade)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              Ver Detalhes
                            </button>
                            <button
                              onClick={() => handleToggleAtivo(mensalidade)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Reativar
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

          {/* Desktop View - Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Paciente</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Valor</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Vence dia</th>
                  {abaAtiva === 'ativas' && (
                    <>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Valor pago</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Método</th>
                    </>
                  )}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider max-w-[100px]">Obs.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-100">
                {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).map((mensalidade) => {
                  const pagamentoMes = pagamentosMesMap[mensalidade.id]
                  const statusPagamento = pagamentoMes?.status || 'sem_pagamento'
                  const diasAteVencimento = getDiasAteVencimento(mensalidade)
                  const exibirLembrete = abaAtiva === 'ativas' && deveExibirLembrete(diasAteVencimento)

                  return (
                    <tr 
                      key={mensalidade.id} 
                      className={`hover:bg-neutral-50 transition-colors ${
                        exibirLembrete && statusPagamento !== 'pago'
                          ? diasAteVencimento === 1
                            ? 'bg-red-50 border-l-4 border-red-600'
                            : 'bg-yellow-50 border-l-4 border-orange-600'
                          : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {exibirLembrete && statusPagamento !== 'pago' && (
                            <Clock className={`w-4 h-4 flex-shrink-0 ${diasAteVencimento === 1 ? 'text-red-600' : 'text-orange-600'}`} />
                          )}
                          <span className="text-sm font-medium text-neutral-900 truncate max-w-[140px]">{mensalidade.paciente_nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-neutral-900">
                        {formatCurrency(mensalidade.valor_mensalidade)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm text-neutral-700">
                          Dia {mensalidade.dia_vencimento}
                        </div>
                        {statusPagamento !== 'pago' && diasAteVencimento != null && (
                          <span className="text-xs text-neutral-500">{diasAteVencimento}d</span>
                        )}
                      </td>
                      {abaAtiva === 'ativas' && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              statusPagamento === 'pago'
                                ? 'bg-green-100 text-green-800'
                                : statusPagamento === 'pendente'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}>
                              {statusPagamento === 'sem_pagamento' ? 'Sem pag.' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-900">
                            {statusPagamento === 'pago' && pagamentoMes?.valor_pago != null ? formatCurrency(pagamentoMes.valor_pago) : '-'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-600 capitalize">
                            {statusPagamento === 'pago' && pagamentoMes?.metodo_pagamento ? String(pagamentoMes.metodo_pagamento) : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 text-sm text-neutral-600 max-w-[100px] truncate" title={mensalidade.observacoes || ''}>
                        {mensalidade.observacoes || '-'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-2">
                          {abaAtiva === 'ativas' ? (
                            <>
                              <button
                                onClick={() => handleEditarMensalidade(mensalidade)}
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"
                              >
                                <Edit className="w-4 h-4" /> Editar
                              </button>
                              {statusPagamento === 'sem_pagamento' ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await mensalidadeService.gerarPagamentosMesAtual()
                                      showToast('Pagamentos do mês gerados.', 'success')
                                      loadData()
                                    } catch (err) {
                                      showToast(err.message || 'Erro ao gerar pagamentos', 'error')
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 font-medium"
                                >
                                  <Plus className="w-4 h-4" /> Gerar mês
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => pagamentoMes && abrirModalMarcarPago({
                                      ...pagamentoMes,
                                      id: pagamentoMes.id,
                                      paciente_nome: mensalidade.paciente_nome,
                                      valor_pago: pagamentoMes.valor_pago ?? mensalidade.valor_mensalidade,
                                      valor_mensalidade: mensalidade.valor_mensalidade
                                    })}
                                    disabled={statusPagamento === 'pago'}
                                    className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Marcar pago
                                  </button>
                                  <button
                                    onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                                    disabled={statusPagamento !== 'pago'}
                                    className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                                  >
                                    <Clock className="w-4 h-4" /> Voltar pendente
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleToggleAtivo(mensalidade)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 font-medium"
                              >
                                <Archive className="w-4 h-4" /> Inativar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditarMensalidade(mensalidade)}
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"
                              >
                                <Edit className="w-4 h-4" /> Ver Detalhes
                              </button>
                              <button
                                onClick={() => handleToggleAtivo(mensalidade)}
                                className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 font-medium"
                              >
                                <CheckCircle className="w-4 h-4" /> Reativar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mensagem quando não há dados */}
            {(abaAtiva === 'ativas' ? mensalidades : mensalidadesInativas).length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <div className="mb-3">
                  <DollarSign className="w-12 h-12 mx-auto text-neutral-300" />
                </div>
                <p className="font-medium">
                  {abaAtiva === 'ativas' 
                    ? 'Nenhuma mensalidade ativa encontrada.'
                    : 'Nenhuma mensalidade inativa encontrada.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Modal de Mensalidade */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowModal(false)
              setSelectedMensalidade(null)
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 flex-shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {selectedMensalidade ? 'Editar mensalidade' : 'Nova mensalidade'}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {selectedMensalidade ? 'Altere valor, dia de vencimento e observações.' : 'Preencha os dados da mensalidade.'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowModal(false); setSelectedMensalidade(null) }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
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
                    <select
                      name="paciente_id"
                      required
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                      <option value="">Selecione</option>
                      {pacientes.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome_completo}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="valor"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    defaultValue={selectedMensalidade?.valor_mensalidade}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Dia do vencimento (1–31) <span className="text-red-500">*</span></label>
                  <select
                    name="dia_vencimento"
                    defaultValue={selectedMensalidade?.dia_vencimento ?? 10}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
                  <textarea
                    name="observacoes"
                    rows={2}
                    defaultValue={selectedMensalidade?.observacoes}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSelectedMensalidade(null) }}
                    className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                  >
                    {selectedMensalidade ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Marcar Pago — campos: valor_pago, metodo_pagamento, observacoes (pagamentos_mensalidades) */}
        {pagamentoParaPagar && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPagamentoParaPagar(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Registrar pagamento</h2>
                <button onClick={() => setPagamentoParaPagar(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
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
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorPagoModal}
                    onChange={(e) => setValorPagoModal(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Método de pagamento</label>
                  <select
                    value={metodoPagamentoModal}
                    onChange={(e) => setMetodoPagamentoModal(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {METODOS_PAGAMENTO.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Observações</label>
                  <textarea
                    value={observacoesPagamentoModal}
                    onChange={(e) => setObservacoesPagamentoModal(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Opcional"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPagamentoParaPagar(null)}
                    className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700"
                  >
                    Confirmar pagamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── FIM MODALIDADE MENSALIDADES ───────────────────────────────────── */}
        </>)}

        {/* ── MODALIDADE PACOTES ────────────────────────────────────────────── */}
        {modalidade === 'pacotes' && (<>

          {/* Sub-abas de Pacotes */}
          <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
            {[
              { id: 'tipos', labelFull: 'Tipos de Profissional', labelShort: 'Tipos', icon: Layers },
              { id: 'ativos', labelFull: 'Ativos', labelShort: 'Ativos', icon: Users },
              { id: 'inativos', labelFull: 'Inativos', labelShort: 'Inativos', icon: Archive },
            ].map(({ id, labelFull, labelShort, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPacotesAbaAtiva(id)}
                className={`flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  pacotesAbaAtiva === id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="sm:hidden">{labelShort}</span>
                  <span className="hidden sm:inline">{labelFull}</span>
                </div>
              </button>
            ))}
          </div>

          {/* ── ABA TIPOS DE PROFISSIONAL ───────────────────────────────────── */}
          {pacotesAbaAtiva === 'tipos' && (
            <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
              {loadingTipos ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
                </div>
              ) : tipos.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <Layers className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                  <p className="font-medium">Nenhum tipo cadastrado.</p>
                  <p className="text-sm mt-1">Toque em <strong>+</strong> no canto superior para começar.</p>
                </div>
              ) : (<>
                {/* Mobile — Cards */}
                <div className="divide-y divide-neutral-100 lg:hidden">
                  {tipos.map(tipo => (
                    <div key={tipo.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{tipo.nome}</p>
                        <p className="text-sm text-neutral-600 mt-0.5">{formatCurrency(tipo.valor_mensal)}<span className="text-xs text-neutral-400">/mês</span></p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAbrirModalTipo(tipo)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          aria-label="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExcluirTipo(tipo)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop — Tabela */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Valor Mensal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {tipos.map(tipo => (
                        <tr key={tipo.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">{tipo.nome}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{formatCurrency(tipo.valor_mensal)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleAbrirModalTipo(tipo)}
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 text-sm font-medium"
                              >
                                <Edit className="w-4 h-4" /> Editar
                              </button>
                              <button
                                onClick={() => handleExcluirTipo(tipo)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 text-sm font-medium"
                              >
                                <Trash2 className="w-4 h-4" /> Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>)}
            </div>
          )}

          {/* ── ABA PACOTES (ATIVOS / INATIVOS) ─────────────────────────────── */}
          {(pacotesAbaAtiva === 'ativos' || pacotesAbaAtiva === 'inativos') && (
            <>
              {/* Estatísticas — apenas aba ativos */}
              {pacotesAbaAtiva === 'ativos' && estatisticasPacotes && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0"><Package className="w-4 h-4 text-blue-600" /></div>
                      <div><p className="text-xs text-neutral-500 mb-0.5">Pacotes Ativos</p><p className="text-xl font-bold text-neutral-900">{estatisticasPacotes.total_pacotes_ativos}</p></div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-yellow-50 rounded-lg flex-shrink-0"><Clock className="w-4 h-4 text-yellow-600" /></div>
                      <div><p className="text-xs text-neutral-500 mb-0.5">Pendentes</p><p className="text-xl font-bold text-neutral-900">{estatisticasPacotes.total_pagamentos_pendentes}</p></div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-red-50 rounded-lg flex-shrink-0"><AlertCircle className="w-4 h-4 text-red-600" /></div>
                      <div><p className="text-xs text-neutral-500 mb-0.5">Pendente R$</p><p className="text-sm font-bold text-neutral-900 truncate">{formatCurrency(estatisticasPacotes.valor_total_pendente)}</p></div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-green-50 rounded-lg flex-shrink-0"><TrendingUp className="w-4 h-4 text-green-600" /></div>
                      <div><p className="text-xs text-neutral-500 mb-0.5">Recebido Mês</p><p className="text-sm font-bold text-neutral-900 truncate">{formatCurrency(estatisticasPacotes.valor_total_recebido_mes)}</p></div>
                    </div>
                  </div>
                </div>
              )}

              {loadingPacotes ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
                </div>
              ) : (() => {
                const lista = pacotesAbaAtiva === 'ativos' ? pacotesAtivos : pacotesInativos
                const isAtivos = pacotesAbaAtiva === 'ativos'

                if (!lista.length) {
                  return (
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-100 text-center py-12 text-neutral-500">
                      <Package className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                      <p className="font-medium">{isAtivos ? 'Nenhum pacote ativo.' : 'Nenhum pacote inativo.'}</p>
                    </div>
                  )
                }

                // Lembretes de vencimento próximo (só na aba ativos)
                const lembretesVenc = isAtivos ? lista.filter(p => {
                  const dias = getDiasAteVencimento(p)
                  const pag = pagamentosPacotesMesMap[p.id]
                  const status = pag?.status || 'sem_pagamento'
                  return dias !== null && dias >= 0 && dias <= 3 && status !== 'pago'
                }).sort((a, b) => getDiasAteVencimento(a) - getDiasAteVencimento(b)) : []

                return (
                  <>
                    {/* Alertas de vencimento próximo */}
                    {lembretesVenc.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-yellow-900 font-semibold mb-4">
                          <AlertCircle className="w-5 h-5" />
                          Pacotes com Vencimento Próximo
                        </h3>
                        <div className="space-y-3">
                          {lembretesVenc.map(pacote => {
                            const dias = getDiasAteVencimento(pacote)
                            const pag = pagamentosPacotesMesMap[pacote.id]
                            return (
                              <div key={pacote.id} className="bg-white border border-yellow-100 p-4 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <div className="flex-1">
                                  <p className="font-semibold text-neutral-900">{pacote.paciente_nome}</p>
                                  <p className="text-sm text-neutral-600 mt-1">
                                    Vence em {dias} dia{dias !== 1 ? 's' : ''} · Dia {pacote.dia_vencimento} · {formatCurrency(pacote.valor_total)}
                                  </p>
                                </div>
                                {pag && (
                                  <button
                                    onClick={() => abrirModalMarcarPagoPacote({ ...pag, paciente_nome: pacote.paciente_nome })}
                                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                                  >
                                    Marcar Pago
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
                      {/* Mobile — Cards */}
                      <div className="block lg:hidden divide-y divide-neutral-100">
                        {lista.map(pacote => {
                          const pagMes = pagamentosPacotesMesMap[pacote.id]
                          const statusPag = pagMes?.status || 'sem_pagamento'
                          const dias = getDiasAteVencimento(pacote)
                          const exibirLembrete = isAtivos && deveExibirLembrete(dias)
                          const corLembrete = getCorLembrete(dias)
                          return (
                            <div
                              key={pacote.id}
                              className={`p-4 space-y-3 ${exibirLembrete && statusPag !== 'pago' ? corLembrete + ' border border-t-0' : ''}`}
                            >
                              {/* Badge lembrete */}
                              {exibirLembrete && statusPag !== 'pago' && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm ${dias === 1 ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`}>
                                  <Clock className="w-4 h-4" />
                                  {dias === 1 ? 'Vence AMANHÃ!' : `Vence em ${dias} dias`}
                                </div>
                              )}

                              {/* Cabeçalho */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-neutral-900">{pacote.paciente_nome}</h3>
                                  <div className="text-sm text-neutral-600 mt-0.5 space-y-0.5">
                                    <p>Vence todo dia {pacote.dia_vencimento}</p>
                                    {statusPag !== 'pago' && dias !== null && (
                                      <p className="text-xs text-neutral-500">({dias} dia{dias !== 1 ? 's' : ''} para vencer)</p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(pacote.itens || []).map(it => (
                                      <span key={it.tipo_profissional_id} className="px-1.5 py-0.5 text-xs bg-neutral-100 rounded">
                                        {it.tipo_nome}{it.quantidade > 1 ? ` x${it.quantidade}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg text-neutral-900">{formatCurrency(pacote.valor_total)}</p>
                                </div>
                              </div>

                              {/* Status do mês */}
                              {isAtivos && (
                                <div className="space-y-1">
                                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    statusPag === 'pago' ? 'bg-green-100 text-green-800'
                                    : statusPag === 'pendente' ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-neutral-100 text-neutral-700'
                                  }`}>
                                    {statusPag === 'sem_pagamento' ? 'Sem pagamento' : statusPag.charAt(0).toUpperCase() + statusPag.slice(1)}
                                  </span>
                                  {statusPag === 'pago' && pagMes && (
                                    <div className="text-xs text-neutral-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-neutral-100">
                                      <span>{formatCurrency(pagMes.valor_pago)}</span>
                                      {pagMes.metodo_pagamento && <span className="capitalize">{pagMes.metodo_pagamento}</span>}
                                    </div>
                                  )}
                                </div>
                              )}

                              {!isAtivos && pacote.observacoes && (
                                <div className="text-sm text-neutral-600 truncate" title={pacote.observacoes}>{pacote.observacoes}</div>
                              )}

                              {/* Ações */}
                              <div className="flex flex-wrap gap-2 pt-2">
                                {isAtivos ? (
                                  <>
                                    <button
                                      onClick={() => handleAbrirModalPacote(pacote)}
                                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                                    >
                                      <Edit className="w-4 h-4" /> Editar
                                    </button>
                                    {statusPag === 'sem_pagamento' ? (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await pacoteService.gerarPagamentosMesAtual()
                                            showToast('Pagamentos gerados.', 'success')
                                            loadPacotesData()
                                          } catch (err) {
                                            showToast(err.message || 'Erro ao gerar', 'error')
                                          }
                                        }}
                                        className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                      >
                                        <Plus className="w-4 h-4" /> Gerar mês
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => pagMes && abrirModalMarcarPagoPacote({ ...pagMes, paciente_nome: pacote.paciente_nome })}
                                          disabled={statusPag === 'pago'}
                                          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                                        >
                                          <CheckCircle className="w-4 h-4" /> Marcar pago
                                        </button>
                                        <button
                                          onClick={() => pagMes && handleMarcarPendentePacote(pagMes)}
                                          disabled={statusPag !== 'pago'}
                                          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-50"
                                        >
                                          <Clock className="w-4 h-4" /> Voltar pendente
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleToggleAtivoPacote(pacote)}
                                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                      <Archive className="w-4 h-4" /> Inativar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleToggleAtivoPacote(pacote)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Reativar
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop — Tabela */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200">
                          <thead className="bg-neutral-50">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Paciente</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Profissionais</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Valor Total</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Vence dia</th>
                              {isAtivos && (
                                <>
                                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Status</th>
                                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Valor pago</th>
                                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Método</th>
                                </>
                              )}
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider max-w-[100px]">Obs.</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-neutral-100">
                            {lista.map(pacote => {
                              const pagMes = pagamentosPacotesMesMap[pacote.id]
                              const statusPag = pagMes?.status || 'sem_pagamento'
                              const dias = getDiasAteVencimento(pacote)
                              const exibirLembrete = isAtivos && deveExibirLembrete(dias)
                              return (
                                <tr
                                  key={pacote.id}
                                  className={`hover:bg-neutral-50 transition-colors ${
                                    exibirLembrete && statusPag !== 'pago'
                                      ? dias === 1 ? 'bg-red-50 border-l-4 border-red-600' : 'bg-yellow-50 border-l-4 border-orange-600'
                                      : ''
                                  }`}
                                >
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      {exibirLembrete && statusPag !== 'pago' && (
                                        <Clock className={`w-4 h-4 flex-shrink-0 ${dias === 1 ? 'text-red-600' : 'text-orange-600'}`} />
                                      )}
                                      <span className="text-sm font-medium text-neutral-900 truncate max-w-[140px]">{pacote.paciente_nome || '-'}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 max-w-[200px]">
                                    <div className="flex flex-wrap gap-1">
                                      {(pacote.itens || []).map(it => (
                                        <span key={it.tipo_profissional_id} className="px-1.5 py-0.5 text-xs bg-neutral-100 rounded whitespace-nowrap">
                                          {it.tipo_nome}{it.quantidade > 1 ? ` x${it.quantidade}` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-neutral-900">{formatCurrency(pacote.valor_total)}</td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <div className="text-sm text-neutral-700">Dia {pacote.dia_vencimento}</div>
                                    {isAtivos && statusPag !== 'pago' && dias != null && (
                                      <span className="text-xs text-neutral-500">{dias}d</span>
                                    )}
                                  </td>
                                  {isAtivos && (
                                    <>
                                      <td className="px-3 py-2.5 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                          statusPag === 'pago' ? 'bg-green-100 text-green-800'
                                          : statusPag === 'pendente' ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-neutral-100 text-neutral-700'
                                        }`}>
                                          {statusPag === 'sem_pagamento' ? 'Sem pag.' : statusPag.charAt(0).toUpperCase() + statusPag.slice(1)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-900">
                                        {statusPag === 'pago' && pagMes?.valor_pago != null ? formatCurrency(pagMes.valor_pago) : '-'}
                                      </td>
                                      <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-600 capitalize">
                                        {statusPag === 'pago' && pagMes?.metodo_pagamento ? pagMes.metodo_pagamento : '-'}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-3 py-2.5 text-sm text-neutral-600 max-w-[100px] truncate" title={pacote.observacoes || ''}>
                                    {pacote.observacoes || '-'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                                    <div className="flex flex-wrap gap-2">
                                      {isAtivos ? (
                                        <>
                                          <button
                                            onClick={() => handleAbrirModalPacote(pacote)}
                                            className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"
                                          >
                                            <Edit className="w-4 h-4" /> Editar
                                          </button>
                                          {statusPag === 'sem_pagamento' ? (
                                            <button
                                              onClick={async () => {
                                                try {
                                                  await pacoteService.gerarPagamentosMesAtual()
                                                  showToast('Pagamentos gerados.', 'success')
                                                  loadPacotesData()
                                                } catch (err) {
                                                  showToast(err.message || 'Erro ao gerar', 'error')
                                                }
                                              }}
                                              className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 font-medium"
                                            >
                                              <Plus className="w-4 h-4" /> Gerar mês
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => pagMes && abrirModalMarcarPagoPacote({ ...pagMes, paciente_nome: pacote.paciente_nome })}
                                                disabled={statusPag === 'pago'}
                                                className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                                              >
                                                <CheckCircle className="w-4 h-4" /> Marcar pago
                                              </button>
                                              <button
                                                onClick={() => pagMes && handleMarcarPendentePacote(pagMes)}
                                                disabled={statusPag !== 'pago'}
                                                className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                                              >
                                                <Clock className="w-4 h-4" /> Voltar pendente
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => handleToggleAtivoPacote(pacote)}
                                            className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 font-medium"
                                          >
                                            <Archive className="w-4 h-4" /> Inativar
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleAtivoPacote(pacote)}
                                          className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 font-medium"
                                        >
                                          <CheckCircle className="w-4 h-4" /> Reativar
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )
              })()}
            </>
          )}

          {/* Modal: Tipo de Profissional */}
          {showModalTipo && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowModalTipo(false)}
            >
              <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-sm"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-neutral-200">
                  <h2 className="text-base font-semibold text-neutral-900">
                    {selectedTipo ? 'Editar tipo' : 'Novo tipo de profissional'}
                  </h2>
                  <button onClick={() => setShowModalTipo(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
                <form onSubmit={handleSalvarTipo} className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Nome <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={tipoNome}
                      onChange={e => setTipoNome(e.target.value)}
                      placeholder="Ex: Fonoaudiólogo, Médico, Psicólogo"
                      required
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Valor Mensal (R$) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tipoValor}
                      onChange={e => setTipoValor(e.target.value)}
                      placeholder="0,00"
                      required
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowModalTipo(false)} className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50">
                      Cancelar
                    </button>
                    <button type="submit" className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
                      {selectedTipo ? 'Salvar' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Criar / Editar Pacote */}
          {showModalPacote && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowModalPacote(false)}
            >
              <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 flex-shrink-0">
                  <h2 className="text-base font-semibold text-neutral-900">
                    {selectedPacote ? `Editar pacote — ${selectedPacote.paciente_nome}` : 'Novo pacote'}
                  </h2>
                  <button onClick={() => setShowModalPacote(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
                <form onSubmit={handleSalvarPacote} className="p-4 space-y-4 overflow-y-auto flex-1">
                  {!selectedPacote && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                      <select
                        value={pacotePacienteId}
                        onChange={e => setPacotePacienteId(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Selecione</option>
                        {pacientes.map(p => (
                          <option key={p.id} value={p.id}>{p.nome_completo}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Dia do vencimento <span className="text-red-500">*</span></label>
                    <select
                      value={pacoteDiaVencimento}
                      onChange={e => setPacoteDiaVencimento(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Dia {d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Tipos de profissional <span className="text-red-500">*</span>
                    </label>
                    {selectedPacote && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-2">
                        Os preços fixados no pacote são exibidos abaixo. Ao salvar, os preços atuais dos tipos serão fixados para este pacote.
                      </p>
                    )}
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-neutral-200 rounded-lg p-2">
                      {tipos.filter(t => t.ativo).length === 0 && (
                        <p className="text-sm text-neutral-500 text-center py-2">Nenhum tipo ativo. Cadastre tipos primeiro.</p>
                      )}
                      {tipos.filter(t => t.ativo).map(tipo => {
                        const item = pacoteItens.find(it => it.tipo_profissional_id === tipo.id)
                        const selecionado = !!item
                        // Preço exibido: snapshot salvo (se edição) ou preço atual do tipo (se novo)
                        const precoExibido = selecionado && item.valor_mensal_snapshot != null
                          ? item.valor_mensal_snapshot
                          : tipo.valor_mensal
                        const precoAlterado = selecionado && item.valor_mensal_snapshot != null
                          && parseFloat(item.valor_mensal_snapshot) !== parseFloat(tipo.valor_mensal)
                        return (
                          <div key={tipo.id} className={`flex items-center gap-3 p-2 rounded-lg border ${selecionado ? 'border-primary-200 bg-primary-50' : 'border-neutral-100 bg-neutral-50'}`}>
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => handleToggleItemPacote(tipo.id)}
                              className="w-4 h-4 accent-primary-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900">{tipo.nome}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs text-neutral-500">
                                  {selecionado && item.valor_mensal_snapshot != null ? 'Fixado: ' : ''}{formatCurrency(precoExibido)}/mês
                                </p>
                                {precoAlterado && (
                                  <span className="text-xs text-amber-700 bg-amber-100 px-1 rounded">
                                    atual: {formatCurrency(tipo.valor_mensal)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {selecionado && (
                              <div className="flex items-center gap-1">
                                <label className="text-xs text-neutral-600">Qtd:</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantidade}
                                  onChange={e => handleAlterarQuantidadeItem(tipo.id, e.target.value)}
                                  className="w-14 px-2 py-1 text-xs border border-neutral-300 rounded focus:ring-1 focus:ring-primary-500"
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {pacoteItens.length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-green-800 font-medium">Total do pacote:</span>
                        <span className="text-sm font-bold text-green-900">{formatCurrency(calcularValorTotalItens())}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
                    <textarea
                      value={pacoteObservacoes}
                      onChange={e => setPacoteObservacoes(e.target.value)}
                      rows={2}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowModalPacote(false)} className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50">
                      Cancelar
                    </button>
                    <button type="submit" className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
                      {selectedPacote ? 'Salvar' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Marcar Pago (Pacote) */}
          {pagamentoPacoteParaPagar && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setPagamentoPacoteParaPagar(null)}
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                  <h2 className="text-lg font-semibold text-neutral-900">Registrar pagamento</h2>
                  <button onClick={() => setPagamentoPacoteParaPagar(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
                <form onSubmit={handleConfirmarMarcarPagoPacote} className="p-6 space-y-4">
                  {pagamentoPacoteParaPagar.paciente_nome && (
                    <div className="p-3 bg-neutral-50 rounded-lg">
                      <p className="text-xs text-neutral-600 font-medium">Paciente</p>
                      <p className="font-medium text-neutral-900">{pagamentoPacoteParaPagar.paciente_nome}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Valor pago (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorPagoPacoteModal}
                      onChange={e => setValorPagoPacoteModal(e.target.value)}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Método de pagamento</label>
                    <select
                      value={metodoPagamentoPacoteModal}
                      onChange={e => setMetodoPagamentoPacoteModal(e.target.value)}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {METODOS_PAGAMENTO.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Observações</label>
                    <textarea
                      value={observacoesPagamentoPacoteModal}
                      onChange={e => setObservacoesPagamentoPacoteModal(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setPagamentoPacoteParaPagar(null)} className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50">
                      Cancelar
                    </button>
                    <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700">
                      Confirmar pagamento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </>)}
        {/* ── FIM MODALIDADE PACOTES ────────────────────────────────────────── */}

        {/* Toast de Notificação */}
        {toast.show && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50 animate-in slide-in-from-bottom">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg w-full sm:min-w-[300px] sm:max-w-md ${
              toast.type === 'success' 
                ? 'bg-green-600 text-white' 
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}>
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button 
                onClick={() => setToast({ show: false, message: '', type: '' })}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal de Confirmação */}
        {confirmDialog.show && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-yellow-50 rounded-full">
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-neutral-900 mb-2">Confirmar Ação</h3>
                    <p className="text-sm text-neutral-600">{confirmDialog.message}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}
                    className="flex-1 px-4 py-2.5 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      confirmDialog.onConfirm?.()
                      setConfirmDialog({ show: false, message: '', onConfirm: null })
                    }}
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
