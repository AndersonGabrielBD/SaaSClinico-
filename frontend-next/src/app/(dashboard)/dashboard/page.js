'use client'

import { useEffect, useState } from 'react'
import { dashboardService } from '@/services/dashboardService'
import { getResumoFinanceiro, getPendencias } from '@/lib/api'
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import LoadingSpinner, { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [resumoFinanceiro, setResumoFinanceiro] = useState(null)
  const [pendencias, setPendencias] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      // Calcular datas do mês atual
      const hoje = new Date()
      const data_inicio = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')
      const data_fim = format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), 'yyyy-MM-dd')
      
      // Buscar dados em paralelo
      const [dashData, financeiroData, pendenciasData] = await Promise.all([
        dashboardService.getStats(),
        getResumoFinanceiro({ data_inicio, data_fim }).catch(() => null),
        getPendencias().catch(() => null)
      ])
      
      setStats(dashData)
      setResumoFinanceiro(financeiroData)
      setPendencias(pendenciasData)
    } catch (err) {
      setError(err.message || 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0)
  }

  const semDadosFinanceiros = !resumoFinanceiro || !resumoFinanceiro.totais
  const resumoTotais = resumoFinanceiro?.totais || {
    pago: 0,
    pendente: 0,
    total: 0
  }
  const resumoContadores = resumoFinanceiro?.contadores || {
    pago: 0,
    pendente: 0,
    total: 0
  }
  const dadosPendencias = pendencias || {
    valor_vencido: 0,
    total_vencidos: 0
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Dashboard</h1>
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-600 mt-1">
          Visão geral da sua clínica
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pacientes */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-600 text-sm font-medium">
              Total de Pacientes
            </span>
            <Users className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-3xl font-bold text-neutral-900">
            {stats?.total_pacientes || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            {stats?.pacientes_ativos || 0} ativos
          </p>
        </div>

        {/* Consultas Hoje */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-600 text-sm font-medium">
              Consultas Hoje
            </span>
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-neutral-900">
            {stats?.consultas_hoje || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            {stats?.consultas_semana || 0} esta semana
          </p>
        </div>

        {/* Faturamento */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-600 text-sm font-medium">
              Faturamento (Mês)
            </span>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-neutral-900">
            {semDadosFinanceiros ? formatarValor(stats?.faturamento_mes || 0) : formatarValor(resumoTotais.pago)}
          </p>
          {semDadosFinanceiros ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-neutral-500">
                Sem dados financeiros detalhados para o mês
              </p>
              <Link
                href="/financeiro"
                className="inline-flex text-xs font-medium text-primary-700 hover:text-primary-900"
              >
                Ir para Financeiro →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {resumoContadores.pago} pagamentos
            </p>
          )}
        </div>

        {/* Taxa de Comparecimento */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-600 text-sm font-medium">
              Taxa de Comparecimento
            </span>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-neutral-900">
            {stats?.taxa_comparecimento?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            Últimos 30 dias
          </p>
        </div>
      </div>

      {/* Resumo Financeiro */}
      {!semDadosFinanceiros && (
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Resumo Financeiro do Mês
            </h3>
            <Link 
              href="/financeiro" 
              className="text-sm text-primary-700 hover:text-primary-900 font-medium transition"
            >
              Ver detalhes →
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-neutral-600">Recebido</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                {formatarValor(resumoTotais.pago)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {resumoContadores.pago} pagamentos
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-medium text-neutral-600">Pendente</span>
              </div>
              <p className="text-xl font-bold text-yellow-600">
                {formatarValor(resumoTotais.pendente)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {resumoContadores.pendente} pagamentos
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-neutral-600">Vencidos</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                {formatarValor(dadosPendencias.valor_vencido)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {dadosPendencias.total_vencidos} pagamentos
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary-500" />
                <span className="text-xs font-medium text-neutral-600">Total</span>
              </div>
              <p className="text-xl font-bold text-primary-600">
                {formatarValor(resumoTotais.total)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {resumoContadores.total} pagamentos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Status */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Status de Hoje
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-neutral-700">Agendadas</span>
              </div>
              <span className="font-semibold text-neutral-900">
                {stats?.distribuicao_status?.agendada || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-neutral-700">Confirmadas</span>
              </div>
              <span className="font-semibold text-neutral-900">
                {stats?.distribuicao_status?.confirmada || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-neutral-700">Concluídas</span>
              </div>
              <span className="font-semibold text-neutral-900">
                {stats?.distribuicao_status?.concluida || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-neutral-700">Canceladas</span>
              </div>
              <span className="font-semibold text-neutral-900">
                {stats?.distribuicao_status?.cancelada || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-neutral-700">Faltou</span>
              </div>
              <span className="font-semibold text-neutral-900">
                {stats?.distribuicao_status?.faltou || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Próximos Agendamentos */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Próximos Agendamentos
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats?.proximos_agendamentos && stats.proximos_agendamentos.length > 0 ? (
              stats.proximos_agendamentos.slice(0, 5).map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {agendamento.paciente?.nome_completo}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {agendamento.profissional?.nome_completo}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {format(new Date(agendamento.data_agendamento), "dd 'de' MMMM", { locale: ptBR })} às {agendamento.horario_inicio}
                    </p>
                  </div>
                  <span className={`
                    text-xs px-2 py-1 rounded-full font-medium
                    ${agendamento.status === 'confirmada' ? 'bg-blue-100 text-blue-700' : 
                      agendamento.status === 'agendada' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-neutral-100 text-neutral-700'}
                  `}>
                    {agendamento.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 text-center py-4">
                Nenhum agendamento próximo
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
