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

  // Modal Tipo
  const [showModalTipo, setShowModalTipo] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState(null)
  const [tipoNome, setTipoNome] = useState('')
  const [tipoProfissionalId, setTipoProfissionalId] = useState('')
  const [tipoValorSessao, setTipoValorSessao] = useState('')
  const [buscaProfissionalTipo, setBuscaProfissionalTipo] = useState('')

  // Modal Pacote
  const [showModalPacote, setShowModalPacote] = useState(false)
  const [selectedPacote, setSelectedPacote] = useState(null)
  const [pacotePacienteId, setPacotePacienteId] = useState('')
  const [pacoteItens, setPacoteItens] = useState([])
  const [pacoteObservacoes, setPacoteObservacoes] = useState('')
  const [buscaTipoModal, setBuscaTipoModal] = useState('')

  // Modal Pagamento
  const [pacoteParaPagar, setPacoteParaPagar] = useState(null)
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

  useEffect(() => {
    if (hasAccess === true) {
      loadData()
    }
  }, [hasAccess])

  // Atualizar lista ao voltar para a aba ou quando sessão é consumida em outro lugar
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasAccess === true) {
        loadData()
      }
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
      const [tiposData, ativosData, inativosData, statsData] = await Promise.all([
        pacoteService.getTipos(),
        pacoteService.getAll(true),
        pacoteService.getAll(false),
        pacoteService.getEstatisticas(),
      ])
      setTipos(Array.isArray(tiposData) ? tiposData : [])
      setPacotesAtivos(Array.isArray(ativosData) ? ativosData : [])
      setPacotesInativos(Array.isArray(inativosData) ? inativosData : [])
      setEstatisticas(statsData)
      try { localStorage.removeItem('pacotes_refresh_needed') } catch (_) {}
    } catch (error) {
      showToast(error.message || 'Erro ao carregar dados', 'error')
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
      const [profData, pacData] = await Promise.all([
        pacoteService.getProfissionais().catch(() => []),
        pacienteService.getAll({ ativo: true }).catch(() => []),
      ])
      setProfissionais(Array.isArray(profData) ? profData : [])
      setPacientes(Array.isArray(pacData) ? pacData : [])
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

  // ── Handlers: Tipo ────────────────────────────────────────────────────────
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
      const payload = {
        nome: tipoNome.trim(),
        valor_sessao: valor,
        profissional_id: tipoProfissionalId || undefined,
      }
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

  // ── Handlers: Pacote ──────────────────────────────────────────────────────
  const handleAbrirModalPacote = (pacote = null) => {
    setSelectedPacote(pacote)
    setPacotePacienteId(pacote?.paciente_id || '')
    setPacoteObservacoes(pacote?.observacoes || '')
    setBuscaTipoModal('')
    setPacoteItens(pacote?.itens?.map(it => ({
      tipo_profissional_id: it.tipo_profissional_id,
      profissional_id: it.profissional_id || null,
      quantidade_sessoes: it.quantidade_sessoes || 1,
      valor_sessao_snapshot: it.valor_sessao ?? null,
    })) || [])
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
        await pacoteService.update(selectedPacote.id, payload)
        showToast('Pacote atualizado!')
      } else {
        await pacoteService.create({
          paciente_id: pacotePacienteId,
          ...payload,
        })
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
          if (isAtivo) {
            await pacoteService.update(pacote.id, { ativo: false })
          } else {
            await pacoteService.ativar(pacote.id)
          }
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
    setPacoteParaPagar(pacote)
    setValorPagoModal(String(pacote.valor_total || 0))
    setMetodoPagamentoModal('pix')
    setObservacoesPagamentoModal('')
  }

  const handleConfirmarPagamento = async (e) => {
    e.preventDefault()
    const pacoteId = pacoteParaPagar?.id
    if (!pacoteId) return
    const valor = parseFloat(valorPagoModal)
    if (isNaN(valor) || valor <= 0) { showToast('Informe um valor válido', 'error'); return }
    try {
      await pacoteService.marcarPago(pacoteId, {
        metodo_pagamento: metodoPagamentoModal,
        valor_pago: valor,
        observacoes: observacoesPagamentoModal.trim() || undefined,
      })
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Pacotes de Sessões</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie pacotes de sessões por profissional</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {abaAtiva === 'tipos' && (
            <button
              onClick={() => handleAbrirModalTipo()}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Tipo</span>
            </button>
          )}
          {abaAtiva === 'ativos' && (
            <button
              onClick={() => handleAbrirModalPacote()}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Novo Pacote</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
        {[
          { id: 'tipos', label: 'Tipos e Valores', icon: Layers },
          { id: 'ativos', label: 'Ativos', icon: Users },
          { id: 'inativos', label: 'Inativos', icon: Archive },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1 sm:gap-2 ${
              abaAtiva === id ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: TIPOS E VALORES ─────────────────────────────────────────── */}
      {abaAtiva === 'tipos' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={buscaTipo}
              onChange={e => setBuscaTipo(e.target.value)}
              placeholder="Pesquisar por nome do profissional ou tipo..."
              className="w-full pl-9 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white shadow-sm"
            />
            {buscaTipo && (
              <button onClick={() => setBuscaTipo('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
            {tiposFiltrados.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <Layers className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <p className="font-medium">{buscaTipo ? 'Nenhum resultado para a busca.' : 'Nenhum tipo cadastrado.'}</p>
                {!buscaTipo && <p className="text-sm mt-1">Clique em <strong>+ Novo Tipo</strong> para começar.</p>}
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="divide-y divide-neutral-100 lg:hidden">
                  {tiposFiltrados.map(tipo => (
                    <div key={tipo.id} className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">{tipo.nome}</p>
                          {tipo.profissional_nome && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <UserCircle className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                              <p className="text-xs text-neutral-500 truncate">{tipo.profissional_nome}</p>
                            </div>
                          )}
                          <p className="text-sm font-medium text-primary-700 mt-1">{formatCurrency(tipo.valor_sessao)}<span className="text-xs text-neutral-400 font-normal">/sessão</span></p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleAbrirModalTipo(tipo)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleExcluirTipo(tipo)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Tipo / Categoria</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Profissional</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Valor/Sessão</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {tiposFiltrados.map(tipo => (
                        <tr key={tipo.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">{tipo.nome}</td>
                          <td className="px-4 py-3 text-sm text-neutral-600">
                            {tipo.profissional_nome ? (
                              <div className="flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                                {tipo.profissional_nome}
                              </div>
                            ) : <span className="text-neutral-400 italic">Genérico</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-primary-700">{formatCurrency(tipo.valor_sessao)}<span className="text-xs text-neutral-400 font-normal ml-1">/sessão</span></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-3">
                              <button onClick={() => handleAbrirModalTipo(tipo)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 text-sm font-medium"><Edit className="w-4 h-4" /> Editar</button>
                              <button onClick={() => handleExcluirTipo(tipo)} className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 text-sm font-medium"><Trash2 className="w-4 h-4" /> Excluir</button>
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

      {/* ── ABA: ATIVOS / INATIVOS ───────────────────────────────────────── */}
      {(abaAtiva === 'ativos' || abaAtiva === 'inativos') && (
        <>
          {abaAtiva === 'ativos' && estatisticas && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Pacotes Ativos', value: estatisticas.total_pacotes_ativos, icon: Package, color: 'blue' },
                { label: 'Pendentes', value: estatisticas.total_pagamentos_pendentes, icon: Clock, color: 'yellow' },
                { label: 'Pendente R$', value: formatCurrency(estatisticas.valor_total_pendente), icon: AlertCircle, color: 'red', isText: true },
                { label: 'Total Recebido', value: formatCurrency(estatisticas.valor_total_recebido), icon: TrendingUp, color: 'green', isText: true },
              ].map(({ label, value, icon: Icon, color, isText }) => (
                <div key={label} className="bg-white p-4 rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 bg-${color}-50 rounded-lg flex-shrink-0`}>
                      <Icon className={`w-4 h-4 text-${color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-500 mb-0.5 truncate">{label}</p>
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
                <div className="bg-white rounded-lg shadow-sm border border-neutral-100 text-center py-12 text-neutral-500">
                  <Package className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                  <p className="font-medium">{isAtivos ? 'Nenhum pacote ativo.' : 'Nenhum pacote inativo.'}</p>
                  {isAtivos && <p className="text-sm mt-1">Clique em <strong>+ Novo Pacote</strong> para criar.</p>}
                </div>
              )
            }

            return (
              <div className="bg-white rounded-lg shadow-sm border border-neutral-100 overflow-hidden">
                {/* Mobile */}
                <div className="block lg:hidden divide-y divide-neutral-100">
                  {lista.map(pacote => (
                    <div key={pacote.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900">{pacote.paciente_nome}</h3>
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            {(pacote.itens || []).map(it => {
                              const utilizadas = it.sessoes_utilizadas ?? 0
                              const total = it.quantidade_sessoes ?? 1
                              const pct = Math.min(100, Math.round((utilizadas / total) * 100))
                              return (
                                <div key={it.id || it.tipo_profissional_id} className="text-xs space-y-0.5">
                                  <div className="flex justify-between text-neutral-600">
                                    <span className="font-medium">{it.profissional_nome || it.tipo_nome}</span>
                                    <span className={utilizadas >= total ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                                      {utilizadas}/{total} sessões
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <p className="font-bold text-lg text-neutral-900 ml-4 shrink-0">{formatCurrency(pacote.valor_total)}</p>
                      </div>

                      {isAtivos && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${pacote.status === 'pago' ? 'bg-green-100 text-green-800' : pacote.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-neutral-100 text-neutral-700'}`}>
                            {pacote.status === 'pendente' ? 'Pendente' : pacote.status === 'pago' ? 'Pago' : pacote.status === 'cancelado' ? 'Cancelado' : pacote.status}
                          </span>
                          {pacote.status === 'pago' && (
                            <span className="text-xs text-neutral-500">{formatCurrency(pacote.valor_pago)} · {pacote.metodo_pagamento}</span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {isAtivos ? (
                          <>
                            <button onClick={() => handleAbrirModalPacote(pacote)} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100">
                              <Edit className="w-4 h-4" /> Editar
                            </button>
                            {pacote.status !== 'pago' && (
                              <button onClick={() => abrirModalPagamento(pacote)} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                                <CheckCircle className="w-4 h-4" /> Marcar pago
                              </button>
                            )}
                            {pacote.status === 'pago' && (
                              <button onClick={() => handleMarcarPendente(pacote)} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100">
                                <Clock className="w-4 h-4" /> Voltar pendente
                              </button>
                            )}
                            <button onClick={() => handleToggleAtivoPacote(pacote)} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                              <Archive className="w-4 h-4" /> Inativar
                            </button>
                            <button onClick={() => handleExcluirPacote(pacote)} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 border border-neutral-200" title="Excluir permanentemente">
                              <Trash2 className="w-4 h-4" /> Excluir
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleToggleAtivoPacote(pacote)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                              <CheckCircle className="w-4 h-4" /> Reativar
                            </button>
                            <button onClick={() => handleExcluirPacote(pacote)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 border border-neutral-200" title="Excluir permanentemente">
                              <Trash2 className="w-4 h-4" /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Paciente</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase min-w-[220px]">Profissionais / Sessões</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Total</th>
                        {isAtivos && (
                          <>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Pagamento</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Valor pago</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Método</th>
                          </>
                        )}
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase max-w-[100px]">Obs.</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {lista.map(pacote => (
                        <tr key={pacote.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-neutral-900 max-w-[140px] truncate">{pacote.paciente_nome || '-'}</td>
                          <td className="px-3 py-2.5 min-w-[220px] max-w-[280px]">
                            <div className="flex flex-col gap-1.5">
                              {(pacote.itens || []).map(it => {
                                const utilizadas = it.sessoes_utilizadas ?? 0
                                const total = it.quantidade_sessoes ?? 1
                                const pct = Math.min(100, Math.round((utilizadas / total) * 100))
                                return (
                                  <div key={it.id || it.tipo_profissional_id} className="text-xs space-y-0.5">
                                    <div className="flex justify-between gap-2 text-neutral-700">
                                      <span className="truncate">{it.profissional_nome || it.tipo_nome}</span>
                                      <span className={`shrink-0 font-semibold ${utilizadas >= total ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {utilizadas}/{total}
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm font-semibold text-neutral-900">{formatCurrency(pacote.valor_total)}</td>
                          {isAtivos && (
                            <>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${pacote.status === 'pago' ? 'bg-green-100 text-green-800' : pacote.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-neutral-100 text-neutral-700'}`}>
                                  {pacote.status === 'pendente' ? 'Pendente' : pacote.status === 'pago' ? 'Pago' : pacote.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-900">
                                {pacote.status === 'pago' && pacote.valor_pago != null ? formatCurrency(pacote.valor_pago) : '-'}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-600 capitalize">
                                {pacote.status === 'pago' && pacote.metodo_pagamento ? pacote.metodo_pagamento : '-'}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-sm text-neutral-600 max-w-[100px] truncate" title={pacote.observacoes || ''}>{pacote.observacoes || '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                            <div className="flex flex-wrap gap-2">
                              {isAtivos ? (
                                <>
                                  <button onClick={() => handleAbrirModalPacote(pacote)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"><Edit className="w-4 h-4" /> Editar</button>
                                  {pacote.status !== 'pago' && (
                                    <button onClick={() => abrirModalPagamento(pacote)} className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 font-medium"><CheckCircle className="w-4 h-4" /> Marcar pago</button>
                                  )}
                                  {pacote.status === 'pago' && (
                                    <button onClick={() => handleMarcarPendente(pacote)} className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1 font-medium"><Clock className="w-4 h-4" /> Voltar pendente</button>
                                  )}
                                  <button onClick={() => handleToggleAtivoPacote(pacote)} className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 font-medium"><Archive className="w-4 h-4" /> Inativar</button>
                                  <button onClick={() => handleExcluirPacote(pacote)} className="text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 font-medium" title="Excluir permanentemente"><Trash2 className="w-4 h-4" /> Excluir</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleToggleAtivoPacote(pacote)} className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 font-medium"><CheckCircle className="w-4 h-4" /> Reativar</button>
                                  <button onClick={() => handleExcluirPacote(pacote)} className="text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 font-medium" title="Excluir permanentemente"><Trash2 className="w-4 h-4" /> Excluir</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ── MODAL: NOVO/EDITAR TIPO ───────────────────────────────────────── */}
      {showModalTipo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModalTipo(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">{selectedTipo ? 'Editar tipo' : 'Novo tipo de profissional'}</h2>
              <button onClick={() => setShowModalTipo(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <form onSubmit={handleSalvarTipo} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo / Categoria <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={tipoNome}
                  onChange={e => setTipoNome(e.target.value)}
                  placeholder="Ex: Fonoaudiologia, Fisioterapia..."
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Profissional</label>
                <p className="text-xs text-neutral-500 mb-1.5">Deixe em branco para um tipo genérico.</p>
                <div className="relative mb-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={buscaProfissionalTipo}
                    onChange={e => { setBuscaProfissionalTipo(e.target.value); if (!e.target.value) setTipoProfissionalId('') }}
                    placeholder="Pesquisar profissional..."
                    className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto border border-neutral-200 rounded-lg">
                  {loadingModal ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setTipoProfissionalId(''); setBuscaProfissionalTipo('') }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${!tipoProfissionalId ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-neutral-50 text-neutral-600'}`}
                      >
                        Nenhum (tipo genérico)
                      </button>
                      {profissionaisFiltradosTipo.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setTipoProfissionalId(p.id); setBuscaProfissionalTipo(p.nome_completo) }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors border-t border-neutral-100 ${tipoProfissionalId === p.id ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-neutral-50 text-neutral-700'}`}
                        >
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">Valor por sessão (R$) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tipoValorSessao}
                  onChange={e => setTipoValorSessao(e.target.value)}
                  placeholder="0,00"
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModalTipo(false)} className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50">Cancelar</button>
                <button type="submit" className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">{selectedTipo ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NOVO/EDITAR PACOTE ─────────────────────────────────────── */}
      {showModalPacote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModalPacote(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-neutral-900">
                {selectedPacote ? `Editar pacote — ${selectedPacote.paciente_nome}` : 'Novo pacote de sessões'}
              </h2>
              <button onClick={() => setShowModalPacote(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <form onSubmit={handleSalvarPacote} className="p-4 space-y-4 overflow-y-auto flex-1">
              {!selectedPacote && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                  <select value={pacotePacienteId} onChange={e => setPacotePacienteId(e.target.value)} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">Selecione o paciente</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Profissionais e Sessões <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={buscaTipoModal}
                    onChange={e => setBuscaTipoModal(e.target.value)}
                    placeholder="Pesquisar profissional ou tipo..."
                    className="w-full pl-8 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto border border-neutral-200 rounded-lg p-2">
                  {tiposFiltradosModal.length === 0 ? (
                    <p className="text-sm text-neutral-500 text-center py-3">
                      {buscaTipoModal ? 'Nenhum resultado.' : 'Cadastre tipos na aba "Tipos e Valores" primeiro.'}
                    </p>
                  ) : tiposFiltradosModal.map(tipo => {
                    const item = pacoteItens.find(it => it.tipo_profissional_id === tipo.id)
                    const selecionado = !!item
                    const vsExibido = selecionado && item.valor_sessao_snapshot != null
                      ? item.valor_sessao_snapshot
                      : tipo.valor_sessao
                    return (
                      <div key={tipo.id} className={`flex items-center gap-3 p-2 rounded-lg border ${selecionado ? 'border-primary-200 bg-primary-50' : 'border-neutral-100 bg-neutral-50'}`}>
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => handleToggleItemPacote(tipo.id)}
                          className="w-4 h-4 accent-primary-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {tipo.profissional_nome || tipo.nome}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {tipo.profissional_nome && (
                              <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 rounded">{tipo.nome}</span>
                            )}
                            <span className="text-xs text-primary-700 font-medium">{formatCurrency(vsExibido)}/sessão</span>
                          </div>
                        </div>
                        {selecionado && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs text-neutral-600 whitespace-nowrap">Sessões:</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade_sessoes}
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
                  <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-green-800 font-medium">Total do pacote:</span>
                    <span className="text-sm font-bold text-green-900">{formatCurrency(calcularTotalPacote())}</span>
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
                <button type="button" onClick={() => setShowModalPacote(false)} className="flex-1 px-3 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50">Cancelar</button>
                <button type="submit" className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">{selectedPacote ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR PAGAMENTO ────────────────────────────────────── */}
      {pacoteParaPagar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPacoteParaPagar(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Registrar pagamento</h2>
              <button onClick={() => setPacoteParaPagar(null)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <form onSubmit={handleConfirmarPagamento} className="p-6 space-y-4">
              {pacoteParaPagar.paciente_nome && (
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-600 font-medium">Paciente</p>
                  <p className="font-medium text-neutral-900">{pacoteParaPagar.paciente_nome}</p>
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
                <button type="button" onClick={() => setPacoteParaPagar(null)} className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50">Cancelar</button>
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
