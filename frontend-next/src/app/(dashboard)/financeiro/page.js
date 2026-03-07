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
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Plus,
  TrendingUp,
  Users,
  Archive,
  X,
  Clock,
  CreditCard,
  ShieldX
} from 'lucide-react'

// Função para formatar moeda no padrão brasileiro
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

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
  const [showVencimentoModal, setShowVencimentoModal] = useState(false)
  const [selectedMensalidade, setSelectedMensalidade] = useState(null)
  const [mensalidadeParaVencimento, setMensalidadeParaVencimento] = useState(null)
  const [novaDataVencimento, setNovaDataVencimento] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('ativas') // 'ativas' ou 'inativas'
  
  // Novos estados para melhor UX
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null })

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

  // Função para calcular dias até vencimento (baseado apenas no dia do mês)
  const getDiasAteVencimento = (mensalidade) => {
    if (!mensalidade?.dia_vencimento) return null
    
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    
    // Criar data de vencimento para este mês
    let vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), mensalidade.dia_vencimento)
    
    // Se o vencimento deste mês já passou, considerar o próximo mês
    if (vencimento < hoje) {
      vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, mensalidade.dia_vencimento)
    }
    
    const diff = vencimento - hoje
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    return dias
  }

  // Função para verificar se deve mostrar lembrete (2-3 dias antes)
  const deveExibirLembrete = (dias) => {
    return dias !== null && dias > 0 && dias <= 3
  }

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

      const pagamentosPorMensalidade = (pagamentosMes || []).reduce((acc, pagamento) => {
        if (pagamento?.mensalidade_id) {
          acc[pagamento.mensalidade_id] = pagamento
        }
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

  const handleMarcarPago = async (pagamento) => {
    try {
      await mensalidadeService.marcarPago(pagamento.pagamento_id, {
        metodo_pagamento: 'pix',
        valor_pago: pagamento.valor_pago
      })
      showToast('Pagamento marcado como pago com sucesso!', 'success')
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      const mensagem = error.message || 'Erro ao marcar pagamento'
      showToast(mensagem, 'error')
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
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      const mensagem = error.message || 'Erro ao salvar status do pagamento'
      showToast(mensagem, 'error')
    }
  }

  const handleAlterarVencimento = async (mensalidade) => {
    const { year: ano, month: mes } = getCurrentYearMonthBrazil()
    const dia = String(mensalidade.dia_vencimento || 1).padStart(2, '0')

    setMensalidadeParaVencimento(mensalidade)
    setNovaDataVencimento(`${ano}-${String(mes).padStart(2, '0')}-${dia}`)
    setShowVencimentoModal(true)
  }

  const handleSalvarNovoVencimento = async (e) => {
    e.preventDefault()

    if (!mensalidadeParaVencimento?.id || !novaDataVencimento) {
      showToast('Selecione uma mensalidade e informe a nova data', 'error')
      return
    }

    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(novaDataVencimento)) {
        showToast('Data inválida. Use o formato correto', 'error')
        return
      }

      // Pegar o pagamento do mês atual
      const pagamentos = await mensalidadeService.getPagamentos({
        paciente_id: mensalidadeParaVencimento.paciente_id,
        mes_referencia: getFirstDayOfMonthBrazil()
      })

      if (pagamentos.length > 0) {
        await mensalidadeService.alterarVencimento(pagamentos[0].id, novaDataVencimento)
        showToast('Data de vencimento alterada com sucesso!', 'success')
        setShowVencimentoModal(false)
        setMensalidadeParaVencimento(null)
        setNovaDataVencimento('')
        loadData()
      } else {
        showToast('Nenhum pagamento do mês atual encontrado', 'error')
      }
    } catch (error) {
      console.error('Erro:', error)
      const mensagem = error.message || 'Erro ao alterar vencimento'
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
    
    try {
      if (selectedMensalidade?.id) {
        await mensalidadeService.update(selectedMensalidade.id, {
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: parseInt(formData.get('dia_vencimento'))
        })
        showToast('Mensalidade atualizada com sucesso!', 'success')
      } else {
        await mensalidadeService.create({
          paciente_id: formData.get('paciente_id'),
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: parseInt(formData.get('dia_vencimento'))
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
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie mensalidades e pagamentos</p>
        </div>
        <button
          onClick={() => {
            setSelectedMensalidade(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Mensalidade
        </button>
      </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1 overflow-x-auto">
          <button
            onClick={() => setAbaAtiva('ativas')}
            className={`flex-1 min-w-[140px] px-4 py-3 font-medium rounded-md transition-all ${
              abaAtiva === 'ativas'
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              <span className="hidden sm:inline">Ativas</span>
              <span className="text-xs font-semibold">({mensalidades.length})</span>
            </div>
          </button>
          <button
            onClick={() => setAbaAtiva('inativas')}
            className={`flex-1 min-w-[140px] px-4 py-3 font-medium rounded-md transition-all ${
              abaAtiva === 'inativas'
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Archive className="w-5 h-5" />
              <span className="hidden sm:inline">Inativas</span>
              <span className="text-xs font-semibold">({mensalidadesInativas.length})</span>
            </div>
          </button>
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

        {/* Alertas de Vencimento - Apenas para aba ativas */}
        {abaAtiva === 'ativas' && proximosVencimentos.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-yellow-900 font-semibold mb-4">
              <AlertCircle className="w-5 h-5" />
              Pagamentos Próximos do Vencimento
              <span className="text-sm font-normal text-yellow-700">(próximos 3 dias)</span>
            </h3>
            <div className="space-y-3">
              {proximosVencimentos.map((venc) => (
                <div key={venc.pagamento_id} className="bg-white border border-yellow-100 p-4 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900">{venc.paciente_nome}</p>
                    <p className="text-sm text-neutral-600 mt-1">
                      Vence em {venc.dias_ate_vencimento} dia{venc.dias_ate_vencimento !== 1 ? 's' : ''} • {(() => {
                        const date = parseDateSafe(venc.data_vencimento)
                        return date ? date.toLocaleDateString('pt-BR') : 'Data inválida'
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg text-neutral-900">{formatCurrency(venc.valor_pago)}</p>
                    <button
                      onClick={() => handleMarcarPago(venc)}
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

        {/* Lista de Mensalidades - Mobile Cards / Desktop Table */}
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
                            <p>Vencimento dia {mensalidade.dia_vencimento}</p>
                            {statusPagamento !== 'pago' && diasAteVencimento !== null && (
                              <p className="text-xs text-neutral-500">({diasAteVencimento} dia{diasAteVencimento !== 1 ? 's' : ''} para vencer)</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-neutral-900">{formatCurrency(mensalidade.valor_mensalidade)}</p>
                        </div>
                      </div>

                      {/* Status do Pagamento */}
                      {abaAtiva === 'ativas' && (
                        <div>
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            statusPagamento === 'pago'
                              ? 'bg-green-100 text-green-800'
                              : statusPagamento === 'pendente'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {statusPagamento === 'sem_pagamento' ? 'Sem pagamento' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                          </span>
                        </div>
                      )}

                      {abaAtiva === 'inativas' && mensalidade.data_inativacao && (
                        <div className="text-sm text-neutral-600">
                          Inativada em {(() => {
                            const date = parseDateSafe(mensalidade.data_inativacao)
                            return date ? date.toLocaleDateString('pt-BR') : 'Data inválida'
                          })()}
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
                            <button
                              onClick={() => handleSalvarStatusPagamento(mensalidade, 'pago')}
                              disabled={statusPagamento === 'pago' || statusPagamento === 'sem_pagamento'}
                              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Pago
                            </button>
                            <button
                              onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                              disabled={statusPagamento !== 'pago'}
                              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-50"
                            >
                              <Clock className="w-4 h-4" />
                              Pendente
                            </button>
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Valor Mensalidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Dia Vencimento
                  </th>
                  {abaAtiva === 'ativas' && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      Status Pagamento
                    </th>
                  )}
                  {abaAtiva === 'inativas' && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      Data Inativação
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Ações
                  </th>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {exibirLembrete && statusPagamento !== 'pago' && (
                            <div className={`flex-shrink-0 ${
                              diasAteVencimento === 1
                                ? 'text-red-600'
                                : 'text-orange-600'
                            }`}>
                              <Clock className="w-5 h-5" />
                            </div>
                          )}
                          <div className="text-sm font-medium text-neutral-900">
                            {mensalidade.paciente_nome}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-neutral-900">
                          {formatCurrency(mensalidade.valor_mensalidade)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-neutral-700">
                            Dia {mensalidade.dia_vencimento}
                          </div>
                          {statusPagamento !== 'pago' && diasAteVencimento !== null && (
                            <div className="text-xs text-neutral-500">
                              {diasAteVencimento} dia{diasAteVencimento !== 1 ? 's' : ''} para vencer
                            </div>
                          )}
                          {exibirLembrete && statusPagamento !== 'pago' && (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${
                              diasAteVencimento === 1
                                ? 'bg-red-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}>
                              {diasAteVencimento === 1 ? 'HOJE' : `${diasAteVencimento}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      {abaAtiva === 'ativas' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            statusPagamento === 'pago'
                              ? 'bg-green-100 text-green-800'
                              : statusPagamento === 'pendente'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {statusPagamento === 'sem_pagamento' ? 'Sem pagamento' : statusPagamento.charAt(0).toUpperCase() + statusPagamento.slice(1)}
                          </span>
                        </td>
                      )}
                      {abaAtiva === 'inativas' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-neutral-600">
                            {mensalidade.data_inativacao 
                              ? (() => {
                                const date = parseDateSafe(mensalidade.data_inativacao)
                                return date ? date.toLocaleDateString('pt-BR') : 'Data inválida'
                              })()
                              : '-'
                            }
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-2">
                          {abaAtiva === 'ativas' ? (
                            <>
                              <button
                                onClick={() => handleEditarMensalidade(mensalidade)}
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1 font-medium"
                              >
                                <Edit className="w-4 h-4" /> Editar
                              </button>
                              <button
                                onClick={() => handleSalvarStatusPagamento(mensalidade, 'pago')}
                                disabled={statusPagamento === 'pago' || statusPagamento === 'sem_pagamento'}
                                className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                              >
                                <CheckCircle className="w-4 h-4" /> Pago
                              </button>
                              <button
                                onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                                disabled={statusPagamento !== 'pago'}
                                className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed font-medium"
                              >
                                <Clock className="w-4 h-4" /> Pendente
                              </button>
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
              className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-primary-600" />
                  </div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    {selectedMensalidade ? 'Editar Mensalidade' : 'Nova Mensalidade'}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedMensalidade(null)
                  }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Corpo do Modal */}
              <form onSubmit={handleSalvarMensalidade} className="p-6 space-y-5">
                {!selectedMensalidade && (
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Paciente <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <select
                        name="paciente_id"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      >
                        <option value="">Selecione um paciente</option>
                        {pacientes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome_completo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Valor da Mensalidade <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="number"
                      name="valor"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      defaultValue={selectedMensalidade?.valor_mensalidade}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Use ponto como separador decimal (ex: 150.00)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Dia do Vencimento <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="number"
                      name="dia_vencimento"
                      min="1"
                      max="31"
                      placeholder="1-31"
                      defaultValue={selectedMensalidade?.dia_vencimento}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Dia do mês em que o pagamento vence (1 a 31)
                  </p>
                </div>
                
                {/* Botões de Ação */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setSelectedMensalidade(null)
                    }}
                    className="flex-1 px-4 py-2.5 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                  >
                    {selectedMensalidade ? 'Salvar Alterações' : 'Criar Mensalidade'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Alterar Vencimento */}
        {showVencimentoModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowVencimentoModal(false)
              setMensalidadeParaVencimento(null)
              setNovaDataVencimento('')
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-yellow-600" />
                  </div>
                  <h2 className="text-base font-semibold text-neutral-900">
                    Alterar Vencimento
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowVencimentoModal(false)
                    setMensalidadeParaVencimento(null)
                    setNovaDataVencimento('')
                  }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Corpo do Modal */}
              <div className="p-6">
                {/* Info do Paciente */}
                <div className="mb-5 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <p className="text-xs text-neutral-600 font-medium mb-1">Paciente</p>
                  <p className="text-base font-semibold text-neutral-900">
                    {mensalidadeParaVencimento?.paciente_nome || 'Paciente'}
                  </p>
                </div>

                <form onSubmit={handleSalvarNovoVencimento} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Nova data de vencimento <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="date"
                        value={novaDataVencimento}
                        onChange={(e) => setNovaDataVencimento(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      Esta alteração afetará apenas o pagamento do mês atual
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVencimentoModal(false)
                        setMensalidadeParaVencimento(null)
                        setNovaDataVencimento('')
                      }}
                      className="flex-1 px-4 py-2.5 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    >
                      Confirmar Alteração
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Toast de Notificação */}
        {toast.show && (
          <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md ${
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
