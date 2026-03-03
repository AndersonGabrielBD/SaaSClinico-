'use client'

import { useState, useEffect } from 'react'
import { mensalidadeService } from '@/services/mensalidadeService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { getUserRole } from '@/utils/auth'
import { 
  DollarSign, 
  Edit, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Plus,
  TrendingUp,
  Users,
  History
} from 'lucide-react'

export default function FinanceiroPage() {
  const [mensalidades, setMensalidades] = useState([])
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

  useEffect(() => {
    loadData()
    loadPacientes()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const mesReferencia = new Date().toISOString().slice(0, 7) + '-01'

      const [mensalidadesData, vencimentosData, statsData, pagamentosMes] = await Promise.all([
        mensalidadeService.getAll(true),
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
      
      setMensalidades(mensalidadesData)
      setPagamentosMesMap(pagamentosPorMensalidade)
      setProximosVencimentos(vencimentosData)
      setEstatisticas(statsData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      alert('Erro ao carregar dados financeiros')
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
      alert('Pagamento marcado como pago!')
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao marcar pagamento')
    }
  }

  const handleSalvarStatusPagamento = async (mensalidade, status) => {
    const pagamentoMes = pagamentosMesMap[mensalidade.id]

    if (!pagamentoMes?.id) {
      alert('Pagamento do mês atual não encontrado para esta mensalidade.')
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

      alert(`Pagamento salvo como ${status === 'pago' ? 'pago' : 'pendente'}!`)
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar status do pagamento')
    }
  }

  const handleAlterarVencimento = async (mensalidade) => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(mensalidade.dia_vencimento || 1).padStart(2, '0')

    setMensalidadeParaVencimento(mensalidade)
    setNovaDataVencimento(`${ano}-${mes}-${dia}`)
    setShowVencimentoModal(true)
  }

  const handleSalvarNovoVencimento = async (e) => {
    e.preventDefault()

    if (!mensalidadeParaVencimento?.id || !novaDataVencimento) {
      alert('Selecione uma mensalidade e informe a nova data.')
      return
    }

    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(novaDataVencimento)) {
        alert('Data inválida. Use YYYY-MM-DD ou DD/MM/YYYY.')
        return
      }

      // Pegar o pagamento do mês atual
      const pagamentos = await mensalidadeService.getPagamentos({
        paciente_id: mensalidadeParaVencimento.paciente_id,
        mes_referencia: new Date().toISOString().slice(0, 7) + '-01'
      })

      if (pagamentos.length > 0) {
        await mensalidadeService.alterarVencimento(pagamentos[0].id, novaDataVencimento)
        alert('Data de vencimento alterada!')
        setShowVencimentoModal(false)
        setMensalidadeParaVencimento(null)
        setNovaDataVencimento('')
        loadData()
      } else {
        alert('Nenhum pagamento do mês atual encontrado para esta mensalidade.')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao alterar vencimento')
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
      } else {
        await mensalidadeService.create({
          paciente_id: formData.get('paciente_id'),
          valor_mensalidade: parseFloat(formData.get('valor')),
          dia_vencimento: parseInt(formData.get('dia_vencimento'))
        })
      }
      
      alert('Mensalidade salva com sucesso!')
      setShowModal(false)
      setSelectedMensalidade(null)
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar mensalidade')
    }
  }

  const handleToggleAtivo = async (mensalidade) => {
    if (!confirm(`Deseja ${mensalidade.ativo ? 'desativar' : 'ativar'} esta mensalidade?`)) return

    try {
      await mensalidadeService.update(mensalidade.id, {
        ativo: !mensalidade.ativo
      })
      alert('Status alterado com sucesso!')
      loadData()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao alterar status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-900">Financeiro - Mensalidades</h1>
        <button
          onClick={() => {
            setSelectedMensalidade(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Nova Mensalidade
        </button>
      </div>

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Mensalidades Ativas</p>
                <p className="text-2xl font-bold">{estatisticas.total_mensalidades_ativas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Pendentes</p>
                <p className="text-2xl font-bold">{estatisticas.total_pagamentos_pendentes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Valor Pendente</p>
                <p className="text-2xl font-bold">
                  R$ {estatisticas.valor_total_pendente?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Recebido no Mês</p>
                <p className="text-2xl font-bold">
                  R$ {estatisticas.valor_total_recebido_mes?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Vencimento */}
      {proximosVencimentos.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="flex items-center gap-2 text-yellow-800 font-semibold mb-3">
            <AlertCircle className="w-5 h-5" />
            Pagamentos Próximos do Vencimento (próximos 3 dias)
          </h3>
          <div className="space-y-2">
            {proximosVencimentos.map((venc) => (
              <div key={venc.pagamento_id} className="flex justify-between items-center bg-white p-3 rounded">
                <div>
                  <p className="font-medium">{venc.paciente_nome}</p>
                  <p className="text-sm text-neutral-600">
                    Vence em {venc.dias_ate_vencimento} dia(s) - {new Date(venc.data_vencimento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-lg">R$ {venc.valor_pago?.toFixed(2)}</p>
                  <button
                    onClick={() => handleMarcarPago(venc)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Marcar Pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Mensalidades */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Paciente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Valor Mensalidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Dia Vencimento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Status Mensalidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Status Pagamento (Mês)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {mensalidades.map((mensalidade) => {
              const pagamentoMes = pagamentosMesMap[mensalidade.id]
              const statusPagamento = pagamentoMes?.status || 'sem_pagamento'

              return (
              <tr key={mensalidade.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-neutral-900">
                    {mensalidade.paciente_nome}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-neutral-900">
                    R$ {mensalidade.valor_mensalidade?.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-neutral-900">
                    Dia {mensalidade.dia_vencimento}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleAtivo(mensalidade)}
                    className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${
                      mensalidade.ativo 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {mensalidade.ativo ? 'Ativa' : 'Inativa'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    statusPagamento === 'pago'
                      ? 'bg-green-100 text-green-800'
                      : statusPagamento === 'pendente'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {statusPagamento === 'sem_pagamento' ? 'Sem pagamento' : statusPagamento}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEditarMensalidade(mensalidade)}
                    className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => handleAlterarVencimento(mensalidade)}
                    className="text-yellow-600 hover:text-yellow-900 inline-flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4" /> Alterar Data
                  </button>
                  <button
                    onClick={() => handleSalvarStatusPagamento(mensalidade, 'pago')}
                    disabled={statusPagamento === 'pago' || statusPagamento === 'sem_pagamento'}
                    className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" /> Salvar como Pago
                  </button>
                  <button
                    onClick={() => handleSalvarStatusPagamento(mensalidade, 'pendente')}
                    disabled={statusPagamento === 'pendente' || statusPagamento === 'sem_pagamento'}
                    className="text-amber-600 hover:text-amber-900 inline-flex items-center gap-1 disabled:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    <AlertCircle className="w-4 h-4" /> Salvar como Pendente
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Modal de Mensalidade */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {selectedMensalidade ? 'Editar Mensalidade' : 'Nova Mensalidade'}
            </h2>
            <form onSubmit={handleSalvarMensalidade} className="space-y-4">
              {!selectedMensalidade && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Paciente
                  </label>
                  <select
                    name="paciente_id"
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="">Selecione um paciente</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome_completo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Valor da Mensalidade
                </label>
                <input
                  type="number"
                  name="valor"
                  step="0.01"
                  defaultValue={selectedMensalidade?.valor_mensalidade}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Dia do Vencimento (1-31)
                </label>
                <input
                  type="number"
                  name="dia_vencimento"
                  min="1"
                  max="31"
                  defaultValue={selectedMensalidade?.dia_vencimento}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setSelectedMensalidade(null)
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Alterar Vencimento */}
      {showVencimentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Alterar Data de Vencimento</h2>
            <p className="text-sm text-neutral-600 mb-4">
              {mensalidadeParaVencimento?.paciente_nome || 'Paciente'}
            </p>

            <form onSubmit={handleSalvarNovoVencimento} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nova data de vencimento
                </label>
                <input
                  type="date"
                  value={novaDataVencimento}
                  onChange={(e) => setNovaDataVencimento(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowVencimentoModal(false)
                    setMensalidadeParaVencimento(null)
                    setNovaDataVencimento('')
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
