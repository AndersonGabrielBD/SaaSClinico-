'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { pacienteService } from '@/services/pacienteService'
import { pacoteService } from '@/services/pacoteService'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import {
  DollarSign,
  Edit,
  CheckCircle,
  AlertCircle,
  Plus,
  TrendingUp,
  Users,
  Archive,
  X,
  Clock,
  ShieldX,
  Package,
  Trash2,
  Layers,
  Search,
  UserCircle,
  Activity,
  LayoutList,
  Wallet,
} from 'lucide-react'

const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const METODOS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque', label: 'Cheque' },
]

const labelMetodo = (m) => METODOS_PAGAMENTO.find(x => x.value === m)?.label || m || '—'

const valorRestantePacote = (pacote) => {
  if (pacote?.valor_restante != null && !Number.isNaN(Number(pacote.valor_restante))) {
    return Math.max(0, Number(pacote.valor_restante))
  }
  const t = Number(pacote?.valor_total || 0)
  const p = Number(pacote?.valor_pago || 0)
  return Math.max(0, t - p)
}

const toDateInput = (v) => {
  if (v == null || v === '') return ''
  const s = typeof v === 'string' ? v : String(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function ProgressBar({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const color = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-primary-500'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${pct >= 100 ? 'text-red-600' : 'text-neutral-700'}`}>
        {used}/{total}
      </span>
    </div>
  )
}

export default function PacotesPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState('tipos')

  const [pacientes, setPacientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [tipos, setTipos] = useState([])
  const [pacotesAtivos, setPacotesAtivos] = useState([])
  const [pacotesInativos, setPacotesInativos] = useState([])
  const [estatisticas, setEstatisticas] = useState(null)

  const [loadingModal, setLoadingModal] = useState(false)

  const [buscaTipo, setBuscaTipo] = useState('')

  const [showModalTipo, setShowModalTipo] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState(null)
  const [tipoNome, setTipoNome] = useState('')
  const [tipoProfissionalId, setTipoProfissionalId] = useState('')
  const [tipoValorSessao, setTipoValorSessao] = useState('')
  const [buscaProfissionalTipo, setBuscaProfissionalTipo] = useState('')

  const [showModalPacote, setShowModalPacote] = useState(false)
  const [selectedPacote, setSelectedPacote] = useState(null)
  const [pacotePacienteId, setPacotePacienteId] = useState('')
  const [pacoteItens, setPacoteItens] = useState([])
  const [pacoteObservacoes, setPacoteObservacoes] = useState('')
  const [buscaTipoModal, setBuscaTipoModal] = useState('')
  const [abaModalPacote, setAbaModalPacote] = useState('sessoes')
  const [finStatus, setFinStatus] = useState('pendente')
  const [finValorPago, setFinValorPago] = useState('')
  const [finMetodoPagamento, setFinMetodoPagamento] = useState('pix')
  const [finValorEntrada, setFinValorEntrada] = useState('')
  const [finMetodoRestante, setFinMetodoRestante] = useState('pix')
  const [finDataPrevista, setFinDataPrevista] = useState('')
  const [finMetodoComplemento, setFinMetodoComplemento] = useState('pix')
  const [finDataPagamento, setFinDataPagamento] = useState('')
  const [finDataComplemento, setFinDataComplemento] = useState('')

  const [pacoteParaPagar, setPacoteParaPagar] = useState(null)
  const [modoPagamentoModal, setModoPagamentoModal] = useState('novo') // 'novo' | 'quitar'
  const [pagamentoParcial, setPagamentoParcial] = useState(false)
  const [valorPagoModal, setValorPagoModal] = useState('')
  const [metodoPagamentoModal, setMetodoPagamentoModal] = useState('pix')
  const [metodoRestanteModal, setMetodoRestanteModal] = useState('pix')
  const [dataPrevistaRestanteModal, setDataPrevistaRestanteModal] = useState('')
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

  useEffect(() => {
    if (hasAccess === true) {
      loadData()
    }
  }, [hasAccess])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasAccess === true) loadData()
    }
    const onStorage = (e) => {
      if (e.key === 'pacotes_refresh_needed' && hasAccess === true) {
        loadData()
        try { localStorage.removeItem('pacotes_refresh_needed') } catch (_) {}
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [hasAccess])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm })
  }

  const loadData = async () => {
    try {
      setLoading(true)
      // allSettled: uma rota falhando não zera as outras (antes: Promise.all falhava tudo).
      const [tiposRes, ativosRes, inativosRes, statsRes] = await Promise.allSettled([
        pacoteService.getTipos(),
        pacoteService.getAll(true),
        pacoteService.getAll(false),
        pacoteService.getEstatisticas(),
      ])
      if (tiposRes.status === 'fulfilled' && Array.isArray(tiposRes.value)) {
        setTipos(tiposRes.value)
      } else {
        if (tiposRes.status === 'rejected') {
          console.error('[pacotes] getTipos', tiposRes.reason)
          showToast(tiposRes.reason?.message || 'Erro ao carregar tipos de profissional', 'error')
        } else {
          setTipos([])
        }
      }
      if (ativosRes.status === 'fulfilled' && Array.isArray(ativosRes.value)) {
        setPacotesAtivos(ativosRes.value)
      } else if (ativosRes.status === 'rejected') {
        console.error('[pacotes] getAll(true)', ativosRes.reason)
      }
      if (inativosRes.status === 'fulfilled' && Array.isArray(inativosRes.value)) {
        setPacotesInativos(inativosRes.value)
      } else if (inativosRes.status === 'rejected') {
        console.error('[pacotes] getAll(false)', inativosRes.reason)
      }
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setEstatisticas(statsRes.value)
      } else if (statsRes.status === 'rejected') {
        console.error('[pacotes] getEstatisticas', statsRes.reason)
      }
      try { localStorage.removeItem('pacotes_refresh_needed') } catch (_) {}
    } finally {
      setLoading(false)
    }
  }

  const loadTipos = async () => {
    try {
      const data = await pacoteService.getTipos()
      setTipos(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast(e.message || 'Erro ao carregar tipos', 'error')
    }
  }

  const loadPacotes = async () => {
    try {
      const [ativosData, inativosData, statsData] = await Promise.all([
        pacoteService.getAll(true),
        pacoteService.getAll(false),
        pacoteService.getEstatisticas(),
      ])
      setPacotesAtivos(Array.isArray(ativosData) ? ativosData : [])
      setPacotesInativos(Array.isArray(inativosData) ? inativosData : [])
      setEstatisticas(statsData)
    } catch (e) {
      showToast('Erro ao carregar pacotes', 'error')
    }
  }

  const loadDadosModal = async () => {
    setLoadingModal(true)
    try {
      const [profData, pacData, tiposRefresh] = await Promise.allSettled([
        pacoteService.getProfissionais(),
        pacienteService.getAll({ ativo: true }),
        pacoteService.getTipos(),
      ])
      setProfissionais(
        profData.status === 'fulfilled' && Array.isArray(profData.value) ? profData.value : []
      )
      setPacientes(
        pacData.status === 'fulfilled' && Array.isArray(pacData.value) ? pacData.value : []
      )
      if (tiposRefresh.status === 'fulfilled' && Array.isArray(tiposRefresh.value)) {
        setTipos(tiposRefresh.value)
      }
    } finally {
      setLoadingModal(false)
    }
  }

  const tiposFiltrados = useMemo(() => {
    const q = buscaTipo.toLowerCase().trim()
    if (!q) return tipos
    return tipos.filter(t =>
      (t.profissional_nome || '').toLowerCase().includes(q) ||
      t.nome.toLowerCase().includes(q)
    )
  }, [tipos, buscaTipo])

  const profissionaisFiltradosTipo = useMemo(() => {
    const q = buscaProfissionalTipo.toLowerCase().trim()
    if (!q) return profissionais
    return profissionais.filter(p => p.nome_completo.toLowerCase().includes(q))
  }, [profissionais, buscaProfissionalTipo])

  const tiposFiltradosModal = useMemo(() => {
    const q = buscaTipoModal.toLowerCase().trim()
    const ativos = tipos.filter(t => t.ativo !== false)
    if (!q) return ativos
    return ativos.filter(t =>
      (t.profissional_nome || '').toLowerCase().includes(q) ||
      t.nome.toLowerCase().includes(q)
    )
  }, [tipos, buscaTipoModal])

  const handleAbrirModalTipo = (tipo = null) => {
    setSelectedTipo(tipo)
    setTipoNome(tipo?.nome || '')
    setTipoProfissionalId(tipo?.profissional_id || '')
    setTipoValorSessao(tipo?.valor_sessao != null ? String(tipo.valor_sessao) : '')
    setBuscaProfissionalTipo(tipo?.profissional_nome || '')
    setShowModalTipo(true)
    loadDadosModal()
  }

  const handleSalvarTipo = async (e) => {
    e.preventDefault()
    const valor = parseFloat(tipoValorSessao)
    if (!tipoNome.trim() || isNaN(valor) || valor <= 0) {
      showToast('Preencha nome e valor válido', 'error')
      return
    }
    try {
      const payload = { nome: tipoNome.trim(), valor_sessao: valor, profissional_id: tipoProfissionalId || undefined }
      if (selectedTipo?.id) {
        await pacoteService.updateTipo(selectedTipo.id, payload)
        showToast('Tipo atualizado!')
      } else {
        await pacoteService.createTipo(payload)
        showToast('Tipo criado!')
      }
      setShowModalTipo(false)
      loadTipos()
    } catch (error) {
      showToast(error.message || 'Erro ao salvar tipo', 'error')
    }
  }

  const handleExcluirTipo = (tipo) => {
    showConfirm(
      `Excluir permanentemente o tipo "${tipo.nome}"${tipo.profissional_nome ? ` (${tipo.profissional_nome})` : ''}? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await pacoteService.deleteTipo(tipo.id)
          showToast('Tipo excluído!')
          loadTipos()
        } catch (error) {
          showToast(error.message || 'Erro ao excluir tipo', 'error')
        }
      }
    )
  }

  const handleAbrirModalPacote = (pacote = null) => {
    setSelectedPacote(pacote)
    setAbaModalPacote('sessoes')
    setPacotePacienteId(pacote?.paciente_id || '')
    setPacoteObservacoes(pacote?.observacoes || '')
    setBuscaTipoModal('')
    setPacoteItens(pacote?.itens?.map(it => ({
      tipo_profissional_id: it.tipo_profissional_id,
      profissional_id: it.profissional_id || null,
      quantidade_sessoes: it.quantidade_sessoes || 1,
      valor_sessao_snapshot: it.valor_sessao ?? null,
    })) || [])
    if (pacote) {
      setFinStatus(pacote.status || 'pendente')
      setFinValorPago(
        pacote.valor_pago != null && pacote.valor_pago !== ''
          ? String(pacote.valor_pago)
          : (pacote.status === 'pendente' ? '' : String(pacote.valor_total ?? ''))
      )
      setFinMetodoPagamento(pacote.metodo_pagamento || 'pix')
      setFinValorEntrada(
        pacote.valor_entrada != null && pacote.valor_entrada !== ''
          ? String(pacote.valor_entrada)
          : ''
      )
      setFinMetodoRestante(pacote.metodo_pagamento_restante || 'pix')
      setFinDataPrevista(toDateInput(pacote.data_prevista_pagamento_restante))
      setFinMetodoComplemento(pacote.metodo_pagamento_complemento || 'pix')
      setFinDataPagamento(toDateInput(pacote.data_pagamento))
      setFinDataComplemento(toDateInput(pacote.data_complemento))
    } else {
      setFinStatus('pendente')
      setFinValorPago('')
      setFinMetodoPagamento('pix')
      setFinValorEntrada('')
      setFinMetodoRestante('pix')
      setFinDataPrevista('')
      setFinMetodoComplemento('pix')
      setFinDataPagamento('')
      setFinDataComplemento('')
    }
    setShowModalPacote(true)
    loadDadosModal()
  }

  const calcularTotalPacote = () => {
    return pacoteItens.reduce((acc, item) => {
      const vs = item.valor_sessao_snapshot != null
        ? parseFloat(item.valor_sessao_snapshot)
        : parseFloat(tipos.find(t => t.id === item.tipo_profissional_id)?.valor_sessao || 0)
      return acc + vs * (item.quantidade_sessoes || 1)
    }, 0)
  }

  const handleToggleItemPacote = (tipoId) => {
    const exists = pacoteItens.find(it => it.tipo_profissional_id === tipoId)
    if (exists) {
      setPacoteItens(prev => prev.filter(it => it.tipo_profissional_id !== tipoId))
    } else {
      const tipo = tipos.find(t => t.id === tipoId)
      setPacoteItens(prev => [...prev, {
        tipo_profissional_id: tipoId,
        profissional_id: tipo?.profissional_id || null,
        quantidade_sessoes: 1,
        valor_sessao_snapshot: null,
      }])
    }
  }

  const handleAlterarQuantidadeItem = (tipoId, quantidade) => {
    const qt = Math.max(1, parseInt(quantidade) || 1)
    setPacoteItens(prev => prev.map(it =>
      it.tipo_profissional_id === tipoId ? { ...it, quantidade_sessoes: qt } : it
    ))
  }

  const handleSalvarPacote = async (e) => {
    e.preventDefault()
    if (!pacoteItens.length) {
      showToast('Adicione ao menos um profissional ao pacote', 'error')
      return
    }
    try {
      const payload = {
        itens: pacoteItens.map(it => ({
          tipo_profissional_id: it.tipo_profissional_id,
          profissional_id: it.profissional_id || undefined,
          quantidade_sessoes: it.quantidade_sessoes,
        })),
        observacoes: pacoteObservacoes.trim() || undefined,
      }
      if (selectedPacote?.id) {
        payload.status = finStatus
        const totalCalc = calcularTotalPacote()
        if (finStatus === 'pendente') {
          /* apenas status — backend zera demais campos */
        } else if (finStatus === 'parcial') {
          const vp = parseFloat(finValorPago)
          if (Number.isNaN(vp) || vp <= 0) {
            showToast('Informe o valor já pago (parcial)', 'error')
            return
          }
          if (vp >= totalCalc - 1e-6) {
            showToast('Valor cheio: use status Quitado (pago)', 'error')
            return
          }
          if (!finDataPrevista) {
            showToast('Informe a data prevista do restante', 'error')
            return
          }
          payload.valor_pago = vp
          payload.metodo_pagamento = finMetodoPagamento
          payload.metodo_pagamento_restante = finMetodoRestante
          payload.data_prevista_pagamento_restante = finDataPrevista
          if (finValorEntrada.trim()) payload.valor_entrada = parseFloat(finValorEntrada)
          if (finDataPagamento) payload.data_pagamento = finDataPagamento
        } else {
          const vp = parseFloat(finValorPago)
          if (Number.isNaN(vp) || vp <= 0) {
            showToast('Informe o valor pago (deve igualar o total ao quitar)', 'error')
            return
          }
          if (Math.abs(vp - totalCalc) > 0.02) {
            showToast(`Quitado: valor pago deve ser ${formatCurrency(totalCalc)} (total atual do pacote)`, 'error')
            return
          }
          payload.valor_pago = vp
          payload.metodo_pagamento = finMetodoPagamento
          const veStr = finValorEntrada.trim()
          payload.valor_entrada = veStr ? parseFloat(finValorEntrada) : null
          if (finDataPagamento) payload.data_pagamento = finDataPagamento
          if (veStr) {
            const ve = parseFloat(finValorEntrada)
            if (!Number.isNaN(ve) && ve > 0 && ve < totalCalc - 1e-6) {
              payload.metodo_pagamento_complemento = finMetodoComplemento
              if (!finDataComplemento) {
                showToast('Informe a data da 2ª parcela', 'error')
                return
              }
              payload.data_complemento = finDataComplemento
            } else {
              payload.metodo_pagamento_complemento = null
              payload.data_complemento = null
            }
          } else {
            payload.metodo_pagamento_complemento = null
            payload.data_complemento = null
          }
        }
        await pacoteService.update(selectedPacote.id, payload)
        showToast('Pacote atualizado!')
      } else {
        await pacoteService.create({ paciente_id: pacotePacienteId, ...payload })
        showToast('Pacote criado!')
      }
      setShowModalPacote(false)
      loadPacotes()
    } catch (error) {
      showToast(error.message || 'Erro ao salvar pacote', 'error')
    }
  }

  const handleToggleAtivoPacote = (pacote) => {
    const isAtivo = pacote.ativo
    showConfirm(
      `Deseja ${isAtivo ? 'desativar' : 'ativar'} o pacote de ${pacote.paciente_nome}?`,
      async () => {
        try {
          if (isAtivo) await pacoteService.update(pacote.id, { ativo: false })
          else await pacoteService.ativar(pacote.id)
          showToast(`Pacote ${isAtivo ? 'desativado' : 'ativado'}!`)
          loadPacotes()
        } catch (error) {
          showToast(error.message || 'Erro ao alterar pacote', 'error')
        }
      }
    )
  }

  const handleExcluirPacote = (pacote) => {
    showConfirm(
      `Excluir permanentemente o pacote de ${pacote.paciente_nome}? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await pacoteService.delete(pacote.id)
          showToast('Pacote excluído!')
          loadPacotes()
        } catch (error) {
          showToast(error.message || 'Erro ao excluir pacote', 'error')
        }
      }
    )
  }

  const abrirModalPagamento = (pacote) => {
    setModoPagamentoModal('novo')
    setPagamentoParcial(false)
    setPacoteParaPagar(pacote)
    setValorPagoModal(String(pacote.valor_total || 0))
    setMetodoPagamentoModal('pix')
    setMetodoRestanteModal('pix')
    setDataPrevistaRestanteModal('')
    setObservacoesPagamentoModal('')
  }

  const abrirModalQuitarSaldo = (pacote) => {
    const rest = valorRestantePacote(pacote)
    setModoPagamentoModal('quitar')
    setPagamentoParcial(false)
    setPacoteParaPagar(pacote)
    setValorPagoModal(String(rest.toFixed(2)))
    setMetodoPagamentoModal(pacote.metodo_pagamento_restante || 'pix')
    setObservacoesPagamentoModal('')
  }

  const handleConfirmarPagamento = async (e) => {
    e.preventDefault()
    const pacoteId = pacoteParaPagar?.id
    if (!pacoteId) return
    const valor = parseFloat(valorPagoModal)
    if (isNaN(valor) || valor <= 0) { showToast('Informe um valor válido', 'error'); return }
    const total = Number(pacoteParaPagar.valor_total || 0)
    try {
      if (modoPagamentoModal === 'quitar') {
        await pacoteService.marcarPago(pacoteId, {
          metodo_pagamento: metodoPagamentoModal,
          valor_pago: valor,
          observacoes: observacoesPagamentoModal.trim() || undefined,
        })
      } else if (pagamentoParcial && valor < total - 1e-6) {
        if (!dataPrevistaRestanteModal) {
          showToast('Informe a data prevista para o restante', 'error')
          return
        }
        await pacoteService.marcarPago(pacoteId, {
          metodo_pagamento: metodoPagamentoModal,
          valor_pago: valor,
          metodo_pagamento_restante: metodoRestanteModal,
          data_prevista_pagamento_restante: dataPrevistaRestanteModal,
          observacoes: observacoesPagamentoModal.trim() || undefined,
        })
      } else {
        if (valor < total - 1e-6) {
          showToast('Valor menor que o total: marque "Pagamento parcial" ou ajuste o valor', 'error')
          return
        }
        await pacoteService.marcarPago(pacoteId, {
          metodo_pagamento: metodoPagamentoModal,
          valor_pago: valor,
          observacoes: observacoesPagamentoModal.trim() || undefined,
        })
      }
      showToast('Pagamento registrado!')
      setPacoteParaPagar(null)
      loadPacotes()
    } catch (error) {
      showToast(error.message || 'Erro ao registrar pagamento', 'error')
    }
  }

  const handleMarcarPendente = async (pacote) => {
    showConfirm('Marcar pagamento como pendente?', async () => {
      try {
        await pacoteService.marcarPendente(pacote.id)
        showToast('Marcado como pendente!')
        loadPacotes()
      } catch (error) {
        showToast(error.message || 'Erro ao marcar pendente', 'error')
      }
    })
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
        <p className="text-neutral-500 mb-4">Você não tem permissão para acessar esta página.</p>
        <p className="text-sm text-neutral-400">Redirecionando...</p>
      </div>
    )
  }

  if (hasAccess === null || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center animate-pulse">
          <Activity className="w-6 h-6 text-primary-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pacotes de Sessões</h1>
          <p className="page-subtitle">Gerencie pacotes de sessões por profissional</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {abaAtiva === 'tipos' && (
            <button
              onClick={() => handleAbrirModalTipo()}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Tipo</span>
            </button>
          )}
          {abaAtiva === 'ativos' && (
            <button
              onClick={() => handleAbrirModalPacote()}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Pacote</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-card border border-neutral-100 p-1.5 flex gap-1">
        {[
          { id: 'tipos', label: 'Tipos e Valores', icon: Layers },
          { id: 'ativos', label: 'Ativos', icon: Package },
          { id: 'inativos', label: 'Inativos', icon: Archive },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-2 ${
              abaAtiva === id ? 'bg-primary-500 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: TIPOS E VALORES */}
      {abaAtiva === 'tipos' && (
        <div className="space-y-4 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={buscaTipo}
              onChange={e => setBuscaTipo(e.target.value)}
              placeholder="Pesquisar por nome do profissional ou tipo..."
              className="input-field pl-10"
            />
            {buscaTipo && (
              <button onClick={() => setBuscaTipo('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-neutral-100 overflow-hidden">
            {tiposFiltrados.length === 0 ? (
              <div className="text-center py-16 text-neutral-500">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-neutral-400" />
                </div>
                <p className="font-bold text-neutral-800">{buscaTipo ? 'Nenhum resultado para a busca.' : 'Nenhum tipo cadastrado.'}</p>
                {!buscaTipo && <p className="text-sm mt-1">Clique em <strong>+ Novo Tipo</strong> para começar.</p>}
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="divide-y divide-neutral-100 lg:hidden">
                  {tiposFiltrados.map(tipo => (
                    <div key={tipo.id} className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Layers className="w-5 h-5 text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-neutral-900">{tipo.nome}</p>
                            {tipo.profissional_nome && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <UserCircle className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                <p className="text-xs text-neutral-500 truncate">{tipo.profissional_nome}</p>
                              </div>
                            )}
                            <p className="text-sm font-bold text-primary-600 mt-1">{formatCurrency(tipo.valor_sessao)}<span className="text-xs text-neutral-400 font-normal">/sessão</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleAbrirModalTipo(tipo)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleExcluirTipo(tipo)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-100">
                    <thead className="bg-neutral-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wide">Tipo / Categoria</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wide">Profissional</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wide">Valor/Sessão</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-600 uppercase tracking-wide">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-50">
                      {tiposFiltrados.map(tipo => (
                        <tr key={tipo.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-sm font-semibold text-neutral-900">{tipo.nome}</td>
                          <td className="px-4 py-3.5 text-sm text-neutral-600">
                            {tipo.profissional_nome ? (
                              <div className="flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                                {tipo.profissional_nome}
                              </div>
                            ) : <span className="text-neutral-400 italic">Genérico</span>}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-bold text-primary-600">{formatCurrency(tipo.valor_sessao)}<span className="text-xs text-neutral-400 font-normal ml-1">/sessão</span></td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-3">
                              <button onClick={() => handleAbrirModalTipo(tipo)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 text-sm font-semibold"><Edit className="w-4 h-4" /> Editar</button>
                              <button onClick={() => handleExcluirTipo(tipo)} className="text-red-500 hover:text-red-700 inline-flex items-center gap-1 text-sm font-semibold"><Trash2 className="w-4 h-4" /> Excluir</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ABA: ATIVOS / INATIVOS */}
      {(abaAtiva === 'ativos' || abaAtiva === 'inativos') && (
        <div className="animate-fade-in space-y-4">
          {abaAtiva === 'ativos' && estatisticas && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { label: 'Pacotes Ativos', value: estatisticas.total_pacotes_ativos, icon: Package, bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'Pendentes', value: estatisticas.total_pagamentos_pendentes, icon: Clock, bg: 'bg-yellow-50', color: 'text-yellow-600' },
                { label: 'Pag. parcial', value: estatisticas.total_pacotes_parcial ?? 0, icon: DollarSign, bg: 'bg-orange-50', color: 'text-orange-600' },
                { label: 'Pendente R$', value: formatCurrency(estatisticas.valor_total_pendente), icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-600', isText: true },
                { label: 'Saldo aberto (parcial)', value: formatCurrency(estatisticas.valor_saldo_aberto_parcial ?? 0), icon: AlertCircle, bg: 'bg-amber-50', color: 'text-amber-700', isText: true },
                { label: 'Total Recebido', value: formatCurrency(estatisticas.valor_total_recebido), icon: TrendingUp, bg: 'bg-green-50', color: 'text-green-600', isText: true },
              ].map(({ label, value, icon: Icon, bg, color, isText }) => (
                <div key={label} className="stat-card">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
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

          {(() => {
            const lista = abaAtiva === 'ativos' ? pacotesAtivos : pacotesInativos
            const isAtivos = abaAtiva === 'ativos'

            if (!lista.length) {
              return (
                <div className="bg-white rounded-2xl shadow-card border border-neutral-100 text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="font-bold text-neutral-800">{isAtivos ? 'Nenhum pacote ativo.' : 'Nenhum pacote inativo.'}</p>
                  {isAtivos && <p className="text-sm text-neutral-500 mt-1">Clique em <strong>+ Novo Pacote</strong> para criar.</p>}
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {lista.map(pacote => {
                  const totalSessoes = (pacote.itens || []).reduce((s, it) => s + (it.quantidade_sessoes || 0), 0)
                  const usedSessoes = (pacote.itens || []).reduce((s, it) => s + (it.sessoes_utilizadas || 0), 0)

                  return (
                    <div key={pacote.id} className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden hover:shadow-card-hover transition-all group">
                      {/* Card header */}
                      <div className="flex items-start gap-3 p-5 pb-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                          {(pacote.paciente_nome || 'P').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-neutral-900 truncate">{pacote.paciente_nome}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold text-neutral-900">{formatCurrency(pacote.valor_total)}</span>
                            {isAtivos && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase
                                ${pacote.status === 'pago' ? 'bg-green-50 text-green-700' :
                                  pacote.status === 'parcial' ? 'bg-orange-50 text-orange-700' :
                                  pacote.status === 'pendente' ? 'bg-yellow-50 text-yellow-700' :
                                  'bg-neutral-100 text-neutral-600'}`}>
                                {pacote.status === 'pendente' ? 'Pendente' : pacote.status === 'pago' ? 'Pago' : pacote.status === 'parcial' ? 'Parcial' : pacote.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sessions progress */}
                      <div className="px-5 pb-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Sessões</p>
                          <p className="text-xs text-neutral-400">{usedSessoes} de {totalSessoes} utilizadas</p>
                        </div>
                        {(pacote.itens || []).map(it => {
                          const utilizadas = it.sessoes_utilizadas ?? 0
                          const total = it.quantidade_sessoes ?? 1
                          return (
                            <div key={it.id || it.tipo_profissional_id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-neutral-700 truncate">{it.profissional_nome || it.tipo_nome}</span>
                              </div>
                              <ProgressBar used={utilizadas} total={total} />
                            </div>
                          )
                        })}
                      </div>

                      {/* Payment info */}
                      {isAtivos && pacote.status === 'parcial' && (
                        <div className="px-5 pb-3 space-y-1.5 text-xs text-neutral-600">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                            <span>
                              Entrada: <strong>{formatCurrency(pacote.valor_pago)}</strong> via {labelMetodo(pacote.metodo_pagamento)}
                            </span>
                          </div>
                          <div className="pl-6">
                            Falta: <strong className="text-orange-700">{formatCurrency(valorRestantePacote(pacote))}</strong>
                            {' · '}
                            previsto {labelMetodo(pacote.metodo_pagamento_restante)}
                            {pacote.data_prevista_pagamento_restante && (
                              <> até <strong>{pacote.data_prevista_pagamento_restante}</strong></>
                            )}
                          </div>
                        </div>
                      )}
                      {isAtivos && pacote.status === 'pago' && (
                        <div className="px-5 pb-3 space-y-1 text-xs text-neutral-500">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span>{formatCurrency(pacote.valor_pago)} quitado</span>
                          </div>
                          {pacote.valor_entrada != null ? (
                            <p className="pl-6 text-neutral-500">
                              1ª parcela: {formatCurrency(pacote.valor_entrada)} ({labelMetodo(pacote.metodo_pagamento)})
                              {pacote.metodo_pagamento_complemento && (
                                <> · 2ª: {labelMetodo(pacote.metodo_pagamento_complemento)}</>
                              )}
                            </p>
                          ) : (
                            <p className="pl-6">{labelMetodo(pacote.metodo_pagamento)}</p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-neutral-50 rounded-b-2xl">
                        {isAtivos ? (
                          <>
                            <button onClick={() => handleAbrirModalPacote(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            {pacote.status === 'pendente' && (
                              <button onClick={() => abrirModalPagamento(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" /> Marcar pago
                              </button>
                            )}
                            {pacote.status === 'parcial' && (
                              <button onClick={() => abrirModalQuitarSaldo(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-800 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                                <DollarSign className="w-3.5 h-3.5" /> Quitar saldo
                              </button>
                            )}
                            {pacote.status === 'pago' && (
                              <button onClick={() => handleMarcarPendente(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                                <Clock className="w-3.5 h-3.5" /> Pendente
                              </button>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                              <button onClick={() => handleToggleAtivoPacote(pacote)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Inativar">
                                <Archive className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleExcluirPacote(pacote)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleToggleAtivoPacote(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" /> Reativar
                            </button>
                            <button onClick={() => handleExcluirPacote(pacote)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors ml-auto">
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── MODAL: NOVO/EDITAR TIPO */}
      {showModalTipo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModalTipo(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">{selectedTipo ? 'Editar tipo' : 'Novo tipo de profissional'}</h2>
              <button onClick={() => setShowModalTipo(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSalvarTipo} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Tipo / Categoria <span className="text-red-500">*</span></label>
                <input type="text" value={tipoNome} onChange={e => setTipoNome(e.target.value)} placeholder="Ex: Fonoaudiologia, Fisioterapia..." required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Profissional</label>
                <p className="text-xs text-neutral-400 mb-1.5">Deixe em branco para um tipo genérico.</p>
                <div className="relative mb-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input type="text" value={buscaProfissionalTipo} onChange={e => { setBuscaProfissionalTipo(e.target.value); if (!e.target.value) setTipoProfissionalId('') }} placeholder="Pesquisar profissional..." className="input-field pl-8" />
                </div>
                <div className="max-h-36 overflow-y-auto border border-neutral-200 rounded-xl">
                  {loadingModal ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setTipoProfissionalId(''); setBuscaProfissionalTipo('') }} className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${!tipoProfissionalId ? 'bg-primary-50 text-primary-700 font-semibold' : 'hover:bg-neutral-50 text-neutral-600'}`}>
                        Nenhum (tipo genérico)
                      </button>
                      {profissionaisFiltradosTipo.map(p => (
                        <button key={p.id} type="button" onClick={() => { setTipoProfissionalId(p.id); setBuscaProfissionalTipo(p.nome_completo) }} className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-t border-neutral-100 ${tipoProfissionalId === p.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'hover:bg-neutral-50 text-neutral-700'}`}>
                          <p className="font-medium">{p.nome_completo}</p>
                          <p className="text-xs text-neutral-500 capitalize">{p.role}</p>
                        </button>
                      ))}
                      {profissionaisFiltradosTipo.length === 0 && buscaProfissionalTipo && (
                        <p className="px-3 py-2 text-sm text-neutral-400 italic">Nenhum profissional encontrado.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Valor por sessão (R$) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0.01" value={tipoValorSessao} onChange={e => setTipoValorSessao(e.target.value)} placeholder="0,00" required className="input-field" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModalTipo(false)} className="flex-1 px-4 py-2.5 border border-neutral-200 text-neutral-700 text-sm font-semibold rounded-xl hover:bg-neutral-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm">{selectedTipo ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NOVO/EDITAR PACOTE */}
      {showModalPacote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModalPacote(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 flex-shrink-0">
              <h2 className="text-base font-bold text-neutral-900">
                {selectedPacote ? `Editar pacote — ${selectedPacote.paciente_nome}` : 'Novo pacote de sessões'}
              </h2>
              <button type="button" onClick={() => setShowModalPacote(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSalvarPacote} className="p-5 space-y-4 overflow-y-auto flex-1">
              {selectedPacote && (
                <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAbaModalPacote('sessoes')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                      abaModalPacote === 'sessoes' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    <LayoutList className="w-4 h-4 flex-shrink-0" /> Sessões
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaModalPacote('financeiro')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                      abaModalPacote === 'financeiro' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    <Wallet className="w-4 h-4 flex-shrink-0" /> Pagamento
                  </button>
                </div>
              )}

              {(!selectedPacote || abaModalPacote === 'sessoes') && (
              <>
              {!selectedPacote && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Paciente <span className="text-red-500">*</span></label>
                  <select value={pacotePacienteId} onChange={e => setPacotePacienteId(e.target.value)} required className="select-field">
                    <option value="">Selecione o paciente</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Profissionais e Sessões <span className="text-red-500">*</span></label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input type="text" value={buscaTipoModal} onChange={e => setBuscaTipoModal(e.target.value)} placeholder="Pesquisar profissional ou tipo..." className="input-field pl-8" />
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto border border-neutral-200 rounded-xl p-2">
                  {tiposFiltradosModal.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-3">
                      {buscaTipoModal ? 'Nenhum resultado.' : 'Cadastre tipos na aba "Tipos e Valores" primeiro.'}
                    </p>
                  ) : tiposFiltradosModal.map(tipo => {
                    const item = pacoteItens.find(it => it.tipo_profissional_id === tipo.id)
                    const selecionado = !!item
                    const vsExibido = selecionado && item.valor_sessao_snapshot != null ? item.valor_sessao_snapshot : tipo.valor_sessao
                    return (
                      <div key={tipo.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${selecionado ? 'border-primary-200 bg-primary-50' : 'border-neutral-100 bg-neutral-50 hover:bg-neutral-100'}`}>
                        <input type="checkbox" checked={selecionado} onChange={() => handleToggleItemPacote(tipo.id)} className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 truncate">{tipo.profissional_nome || tipo.nome}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {tipo.profissional_nome && <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 rounded-md">{tipo.nome}</span>}
                            <span className="text-xs text-primary-600 font-semibold">{formatCurrency(vsExibido)}/sessão</span>
                          </div>
                        </div>
                        {selecionado && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs text-neutral-500 whitespace-nowrap">Sessões:</label>
                            <input type="number" min="1" value={item.quantidade_sessoes} onChange={e => handleAlterarQuantidadeItem(tipo.id, e.target.value)} className="w-14 px-2 py-1 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {pacoteItens.length > 0 && (
                  <div className="mt-2 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-primary-800 font-semibold">Total do pacote:</span>
                    <span className="text-sm font-bold text-primary-900">{formatCurrency(calcularTotalPacote())}</span>
                  </div>
                )}
              </div>
              </>
              )}

              {selectedPacote && abaModalPacote === 'financeiro' && (
                <div className="space-y-4 rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50/80 to-white p-4 sm:p-5">
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Ajuste status, valores e formas de pagamento se algo foi registrado incorretamente (parcial, datas ou métodos).
                    Se alterar sessões na outra aba, o total do pacote muda — confira o valor quitado.
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Situação</label>
                    <select
                      value={finStatus}
                      onChange={(e) => {
                        const s = e.target.value
                        setFinStatus(s)
                        if (s === 'pago') {
                          setFinValorPago(String(calcularTotalPacote().toFixed(2)))
                        }
                        if (s === 'pendente') {
                          setFinValorPago('')
                        }
                      }}
                      className="select-field"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="parcial">Parcial (entrada + saldo depois)</option>
                      <option value="pago">Quitado</option>
                    </select>
                  </div>
                  {finStatus === 'pendente' && (
                    <div className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl p-3">
                      O pacote ficará sem registro de pagamento (como se nunca tivesse sido pago).
                    </div>
                  )}
                  {finStatus !== 'pendente' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                            {finStatus === 'parcial' ? 'Valor já pago (R$)' : 'Valor pago / quitado (R$)'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={finValorPago}
                            onChange={(e) => setFinValorPago(e.target.value)}
                            className="input-field"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Forma de pagamento (entrada / única)</label>
                          <select value={finMetodoPagamento} onChange={(e) => setFinMetodoPagamento(e.target.value)} className="select-field">
                            {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Data do 1º pagamento</label>
                        <input type="date" value={finDataPagamento} onChange={(e) => setFinDataPagamento(e.target.value)} className="input-field" />
                        <p className="text-[11px] text-neutral-400 mt-1">Opcional; se vazio, o sistema usa a data atual ao salvar.</p>
                      </div>
                    </>
                  )}
                  {finStatus === 'parcial' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-100">
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Forma prevista — saldo restante</label>
                        <select value={finMetodoRestante} onChange={(e) => setFinMetodoRestante(e.target.value)} className="select-field">
                          {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Data prevista — quitar restante</label>
                        <input type="date" value={finDataPrevista} onChange={(e) => setFinDataPrevista(e.target.value)} className="input-field" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Valor da 1ª parcela (opcional)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={finValorEntrada}
                          onChange={(e) => setFinValorEntrada(e.target.value)}
                          className="input-field"
                          placeholder="Igual ao valor pago se vazio"
                        />
                      </div>
                    </div>
                  )}
                  {finStatus === 'pago' && (
                    <div className="space-y-3 pt-1 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-700">Registro em duas parcelas (opcional)</p>
                      <p className="text-[11px] text-neutral-500">Preencha só se o pacote foi pago em duas vezes; informe valor da 1ª parcela menor que o total.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Valor 1ª parcela (R$)</label>
                          <input type="number" step="0.01" min="0" value={finValorEntrada} onChange={(e) => setFinValorEntrada(e.target.value)} className="input-field" placeholder="Vazio = pagamento único" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Forma 2ª parcela</label>
                          <select value={finMetodoComplemento} onChange={(e) => setFinMetodoComplemento(e.target.value)} className="select-field">
                            {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Data 2ª parcela</label>
                          <input type="date" value={finDataComplemento} onChange={(e) => setFinDataComplemento(e.target.value)} className="input-field" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Observações</label>
                <textarea value={pacoteObservacoes} onChange={e => setPacoteObservacoes(e.target.value)} rows={2} placeholder="Opcional" className="input-field resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModalPacote(false)} className="flex-1 px-4 py-2.5 border border-neutral-200 text-neutral-700 text-sm font-semibold rounded-xl hover:bg-neutral-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm">{selectedPacote ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR PAGAMENTO */}
      {pacoteParaPagar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setPacoteParaPagar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">
                {modoPagamentoModal === 'quitar' ? 'Quitar saldo do pacote' : 'Registrar pagamento'}
              </h2>
              <button type="button" onClick={() => setPacoteParaPagar(null)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleConfirmarPagamento} className="p-5 space-y-4">
              {pacoteParaPagar.paciente_nome && (
                <div className="p-3 bg-neutral-50 rounded-xl">
                  <p className="text-xs text-neutral-500 font-medium">Paciente</p>
                  <p className="font-semibold text-neutral-900">{pacoteParaPagar.paciente_nome}</p>
                  <p className="text-xs text-neutral-500 mt-1">Total do pacote: <strong>{formatCurrency(pacoteParaPagar.valor_total)}</strong></p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                  {modoPagamentoModal === 'quitar' ? 'Valor do saldo (R$)' : 'Valor pago agora (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorPagoModal}
                  onChange={e => setValorPagoModal(e.target.value)}
                  className="input-field"
                  required
                  readOnly={modoPagamentoModal === 'quitar'}
                />
                {modoPagamentoModal === 'novo' && (
                  <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pagamentoParcial}
                      onChange={e => {
                        const on = e.target.checked
                        setPagamentoParcial(on)
                        if (on) setValorPagoModal('')
                        else setValorPagoModal(String(pacoteParaPagar.valor_total || 0))
                      }}
                      className="w-4 h-4 accent-primary-600 rounded"
                    />
                    <span>Pagamento parcial (cliente paga o restante depois)</span>
                  </label>
                )}
              </div>
              {modoPagamentoModal === 'novo' && pagamentoParcial && valorPagoModal !== '' && !Number.isNaN(parseFloat(valorPagoModal)) && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-sm text-orange-900">
                  <p>
                    Falta receber:{' '}
                    <strong>
                      {formatCurrency(Math.max(0, Number(pacoteParaPagar.valor_total || 0) - (parseFloat(valorPagoModal) || 0)))}
                    </strong>
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                  {modoPagamentoModal === 'quitar' || (pagamentoParcial && modoPagamentoModal === 'novo')
                    ? 'Forma de pagamento (valor pago agora)'
                    : 'Forma de pagamento'}
                </label>
                <select value={metodoPagamentoModal} onChange={e => setMetodoPagamentoModal(e.target.value)} className="select-field">
                  {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              {modoPagamentoModal === 'novo' && pagamentoParcial && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Forma prevista para o saldo restante</label>
                    <select value={metodoRestanteModal} onChange={e => setMetodoRestanteModal(e.target.value)} className="select-field">
                      {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Data prevista para quitar o restante</label>
                    <input
                      type="date"
                      value={dataPrevistaRestanteModal}
                      onChange={e => setDataPrevistaRestanteModal(e.target.value)}
                      className="input-field"
                      required={pagamentoParcial}
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Observações</label>
                <textarea value={observacoesPagamentoModal} onChange={e => setObservacoesPagamentoModal(e.target.value)} rows={2} className="input-field resize-none" placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPacoteParaPagar(null)} className="flex-1 px-4 py-2.5 border border-neutral-200 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-scale-in">
          <div className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-2xl shadow-float border overflow-hidden bg-white ${toast.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
            <div className={`w-1 self-stretch rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${toast.type === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
              {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>
            <p className="text-sm font-medium text-neutral-800 py-2.5">{toast.message}</p>
            <button onClick={() => setToast({ show: false, message: '', type: '' })} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors ml-2">
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center flex-shrink-0"><AlertCircle className="w-6 h-6 text-yellow-600" /></div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-neutral-900 mb-2">Confirmar Ação</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })} className="flex-1 px-4 py-2.5 border border-neutral-200 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-colors">Cancelar</button>
                <button onClick={() => { confirmDialog.onConfirm?.(); setConfirmDialog({ show: false, message: '', onConfirm: null }) }} className="flex-1 px-4 py-2.5 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-all shadow-sm">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
