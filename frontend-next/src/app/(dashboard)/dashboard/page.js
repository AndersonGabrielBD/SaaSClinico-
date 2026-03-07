'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardService } from '@/services/dashboardService'
import { getResumoFinanceiro, getPendencias } from '@/lib/api'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldX
} from 'lucide-react'
import LoadingSpinner, { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { parseDateSafe } from '@/lib/dateUtils'

export default function DashboardPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(null) // null = verificando
  const [stats, setStats] = useState(null)
  const [resumoFinanceiro, setResumoFinanceiro] = useState(null)
  const [pendencias, setPendencias] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Verificar permissão de acesso
  useEffect(() => {
    const userRole = getUserRole()
    const canAccess = canAccessModule(userRole, 'dashboard')
    setHasAccess(canAccess)
    
    if (!canAccess && userRole) {
      // Redirecionar após 2 segundos
      const timeout = setTimeout(() => {
        router.push('/pacientes')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [router])

  useEffect(() => {
    // Só carregar dados se tiver acesso
    if (hasAccess === true) {
      loadStats()
    }
  }, [hasAccess])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError('') // Limpar erro anterior
      
      // Calcular datas do mês atual
      const hoje = new Date()
      const data_inicio = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')
      const data_fim = format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), 'yyyy-MM-dd')
      
      // Buscar dados em paralelo com tratamento de erro individual
      const [dashData, financeiroData, pendenciasData] = await Promise.allSettled([
        dashboardService.getStats(),
        getResumoFinanceiro({ data_inicio, data_fim }),
        getPendencias()
      ])
      
      // Processar resultados individuais
      if (dashData.status === 'fulfilled') {
        setStats(dashData.value)
      } else {
        console.error('Erro ao carregar estatísticas:', dashData.reason)
      }
      
      if (financeiroData.status === 'fulfilled') {
        setResumoFinanceiro(financeiroData.value)
      } else {
        console.warn('Dados financeiros não disponíveis:', financeiroData.reason)
        setResumoFinanceiro(null)
      }
      
      if (pendenciasData.status === 'fulfilled') {
        setPendencias(pendenciasData.value)
      } else {
        console.warn('Pendências não disponíveis:', pendenciasData.reason)
        setPendencias(null)
      }
      
      // Só mostrar erro se NENHUM dado foi carregado
      if (dashData.status === 'rejected' && financeiroData.status === 'rejected' && pendenciasData.status === 'rejected') {
        throw new Error('Não foi possível carregar nenhum dado do dashboard')
      }
      
    } catch (err) {
      console.error('Erro no dashboard:', err)
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
      <div>
        <div className="mb-6">
          <div className="h-5 w-28 bg-neutral-100 rounded-full animate-pulse mb-2" />
          <div className="h-3.5 w-44 bg-neutral-100 rounded-full animate-pulse" />
        </div>
        <LoadingSkeleton rows={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Visão geral da sua clínica</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-5 border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Pacientes</p>
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{stats?.total_pacientes || 0}</p>
          <p className="text-xs text-neutral-400 mt-1">{stats?.pacientes_ativos || 0} ativos</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Hoje</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{stats?.consultas_hoje || 0}</p>
          <p className="text-xs text-neutral-400 mt-1">{stats?.consultas_semana || 0} esta semana</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Faturamento</p>
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {semDadosFinanceiros ? formatarValor(stats?.faturamento_mes || 0) : formatarValor(resumoTotais.pago)}
          </p>
          {semDadosFinanceiros ? (
            <Link href="/financeiro" className="text-xs text-primary-600 hover:underline mt-1 block">Ver financeiro →</Link>
          ) : (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />{resumoContadores.pago} pgtos
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Comparecimento</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{stats?.taxa_comparecimento?.toFixed(1) || 0}%</p>
          <p className="text-xs text-neutral-400 mt-1">Últimos 30 dias</p>
        </div>
      </div>

      {/* Financial summary */}
      {!semDadosFinanceiros && (
        <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary-500" />
              Resumo Financeiro — Mês Atual
            </h3>
            <Link href="/financeiro" className="text-xs text-primary-600 hover:underline font-medium">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-neutral-50">
            {[
              { label: 'Recebido', value: resumoTotais.pago, count: resumoContadores.pago, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Pendente', value: resumoTotais.pendente, count: resumoContadores.pendente, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Vencido', value: dadosPendencias.valor_vencido, count: dadosPendencias.total_vencidos, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Total', value: resumoTotais.total, count: resumoContadores.total, icon: DollarSign, color: 'text-primary-600', bg: 'bg-primary-50' },
            ].map(({ label, value, count, icon: Icon, color, bg }) => (
              <div key={label} className="p-5">
                <div className={`inline-flex p-1.5 rounded-lg ${bg} mb-2`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-xs text-neutral-500 mb-1">{label}</p>
                <p className={`text-base font-bold ${color}`}>{formatarValor(value)}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{count} pgtos</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="px-5 py-4 border-b border-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-800">Status de Hoje</h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Agendadas', key: 'agendada', icon: Clock, color: 'text-yellow-500', dot: 'bg-yellow-400' },
              { label: 'Confirmadas', key: 'confirmada', icon: CheckCircle, color: 'text-blue-500', dot: 'bg-blue-400' },
              { label: 'Concluídas', key: 'concluida', icon: CheckCircle, color: 'text-green-500', dot: 'bg-green-400' },
              { label: 'Canceladas', key: 'cancelada', icon: XCircle, color: 'text-red-500', dot: 'bg-red-400' },
              { label: 'Faltou', key: 'faltou', icon: AlertCircle, color: 'text-orange-500', dot: 'bg-orange-400' },
            ].map(({ label, key, dot }) => {
              const val = stats?.distribuicao_status?.[key] || 0
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-sm text-neutral-600">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{val}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Next appointments */}
        <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="px-5 py-4 border-b border-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-800">Próximos Agendamentos</h3>
          </div>
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {stats?.proximos_agendamentos?.length > 0 ? (
              stats.proximos_agendamentos.slice(0, 5).map((ag) => (
                <div key={ag.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{ag.paciente?.nome_completo}</p>
                    <p className="text-xs text-neutral-400">
                      {(() => {
                        const date = parseDateSafe(ag.data_agendamento)
                        return date ? format(date, "dd/MM", { locale: ptBR }) : '—'
                      })()} · {ag.horario_inicio}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                    ${ag.status === 'confirmada' ? 'bg-blue-100 text-blue-700' :
                      ag.status === 'agendada' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-neutral-100 text-neutral-600'}`}>
                    {ag.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">Nenhum agendamento próximo</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
