'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardService } from '@/services/dashboardService'
import { pacoteService } from '@/services/pacoteService'
import { getResumoFinanceiro, getPendencias } from '@/lib/api'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldX,
  ArrowUpRight,
  ArrowRight,
  Activity,
  UserCheck,
  CalendarCheck,
  Package
} from 'lucide-react'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { parseDateSafe, formatTimeHHmm } from '@/lib/dateUtils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'

const STATUS_COLORS = {
  agendada: '#EAB308',
  confirmada: '#3B82F6',
  concluida: '#22C55E',
  cancelada: '#EF4444',
  faltou: '#F97316',
  em_atendimento: '#8B5CF6',
}

const STATUS_LABELS = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  faltou: 'Faltou',
  em_atendimento: 'Em Atend.',
}

const CHART_COLORS = ['#2D6A4F', '#3B82F6', '#EAB308', '#EF4444', '#F97316', '#8B5CF6']

const METODO_PAGAMENTO_LABELS = {
  pix: 'PIX',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  cheque: 'Cheque',
}

function StatCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, trend, trendLabel, href }) {
  const content = (
    <div className="stat-card group cursor-pointer animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors" />
        )}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight">{value}</p>
      <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-wide">{title}</p>
      {(subtitle || trend !== undefined) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-neutral-400">{subtitle}</span>}
        </div>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function ChartCard({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden animate-slide-up ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-50">
        <div>
          <h3 className="text-sm font-bold text-neutral-800">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/60 bg-white/95 px-4 py-3 shadow-lg shadow-emerald-900/10 backdrop-blur-md">
      <p className="text-xs font-bold text-neutral-800 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs text-neutral-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-neutral-500">{entry.name}:</span>
          <span className="font-bold text-neutral-900 tabular-nums">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function KpiMini({ icon: Icon, label, value, sub, accent }) {
  const accents = {
    emerald: 'from-emerald-500/15 to-teal-500/5 border-emerald-200/60 text-emerald-800',
    amber: 'from-amber-500/15 to-orange-500/5 border-amber-200/60 text-amber-900',
    rose: 'from-rose-500/15 to-red-500/5 border-rose-200/60 text-rose-900',
    slate: 'from-slate-500/10 to-neutral-500/5 border-neutral-200/80 text-neutral-800',
    blue: 'from-blue-500/15 to-indigo-500/5 border-blue-200/60 text-blue-900',
    orange: 'from-orange-500/15 to-amber-500/5 border-orange-200/60 text-orange-900',
  }
  const c = accents[accent] || accents.slate
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-3.5 sm:p-4 ${c}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shadow-sm">
          <Icon className="w-4 h-4 opacity-80" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[10px] mt-1 opacity-70 font-medium">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(null)
  const [stats, setStats] = useState(null)
  const [resumoFinanceiro, setResumoFinanceiro] = useState(null)
  const [pendencias, setPendencias] = useState(null)
  const [resumoPacotes, setResumoPacotes] = useState(null)
  const [statsPacotes, setStatsPacotes] = useState(null)
  const [abaFinanceiroDash, setAbaFinanceiroDash] = useState('mensalidades')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const userRole = getUserRole()
    const canAccess = canAccessModule(userRole, 'dashboard')
    setHasAccess(canAccess)
    
    if (!canAccess && userRole) {
      const timeout = setTimeout(() => {
        router.push('/agenda')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [router])

  useEffect(() => {
    if (hasAccess === true) {
      loadStats()
    }
  }, [hasAccess])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError('')
      
      const hoje = new Date()
      const data_inicio = format(startOfMonth(hoje), 'yyyy-MM-dd')
      const data_fim = format(endOfMonth(hoje), 'yyyy-MM-dd')
      
      const [dashData, financeiroData, pendenciasData, statsPacotesData, resumoPacotesData] = await Promise.allSettled([
        dashboardService.getStats(),
        getResumoFinanceiro({ data_inicio, data_fim }),
        getPendencias(),
        pacoteService.getEstatisticas(),
        pacoteService.getResumoFinanceiroPacotes({ data_inicio, data_fim }),
      ])
      
      if (dashData.status === 'fulfilled') setStats(dashData.value)
      if (financeiroData.status === 'fulfilled') setResumoFinanceiro(financeiroData.value)
      if (pendenciasData.status === 'fulfilled') setPendencias(pendenciasData.value)
      if (statsPacotesData.status === 'fulfilled') setStatsPacotes(statsPacotesData.value)
      if (resumoPacotesData.status === 'fulfilled') setResumoPacotes(resumoPacotesData.value)
      
      if (dashData.status === 'rejected' && financeiroData.status === 'rejected' && pendenciasData.status === 'rejected') {
        throw new Error('Não foi possível carregar nenhum dado do dashboard')
      }
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

  const formatarValorCurto = (valor) => {
    if (valor >= 1000) return `R$ ${(valor / 1000).toFixed(1)}k`
    return formatarValor(valor)
  }

  const semDadosFinanceiros = !resumoFinanceiro || !resumoFinanceiro.totais
  const resumoTotais = resumoFinanceiro?.totais || { pago: 0, pendente: 0, total: 0 }
  const resumoContadores = resumoFinanceiro?.contadores || { pago: 0, pendente: 0, total: 0 }
  const dadosPendencias = pendencias || { valor_vencido: 0, total_vencidos: 0 }

  const statusChartData = useMemo(() => {
    if (!stats?.distribuicao_status) return []
    return Object.entries(stats.distribuicao_status)
      .filter(([, val]) => val > 0)
      .map(([key, val]) => ({
        name: STATUS_LABELS[key] || key,
        value: val,
        color: STATUS_COLORS[key] || '#CED4DA',
      }))
  }, [stats])

  const financeiroChartData = useMemo(() => {
    if (semDadosFinanceiros) return []
    return [
      { name: 'Recebido', valor: resumoTotais.pago, fill: '#22C55E' },
      { name: 'Pendente', valor: resumoTotais.pendente, fill: '#EAB308' },
      { name: 'Vencido', valor: dadosPendencias.valor_vencido, fill: '#EF4444' },
    ].filter(d => d.valor > 0)
  }, [resumoTotais, dadosPendencias, semDadosFinanceiros])

  const pacotesTotaisMes = resumoPacotes?.totais || {}
  const semDadosPacotesMes =
    !resumoPacotes?.totais ||
    (Number(pacotesTotaisMes.recebido_mes || 0) <= 0 &&
      Number(pacotesTotaisMes.recebido_entradas_parcial || 0) <= 0 &&
      Number(pacotesTotaisMes.recebido_quitacoes || 0) <= 0 &&
      Number(pacotesTotaisMes.recebido_avista || 0) <= 0)

  const pacotesMetodoPie = useMemo(() => {
    const arr = resumoPacotes?.por_metodo
    if (!Array.isArray(arr) || !arr.length) return []
    return arr
      .map((row, i) => ({
        name: METODO_PAGAMENTO_LABELS[row.metodo] || row.metodo,
        value: Number(row.valor || 0),
        color: CHART_COLORS[i % CHART_COLORS.length],
        gradId: `pkgMetGrad${i}`,
      }))
      .filter(d => d.value > 0)
  }, [resumoPacotes])

  const mensalidadesDonutData = useMemo(() => {
    if (semDadosFinanceiros) return []
    const rows = [
      { name: 'Recebido', value: Number(resumoTotais.pago || 0), gradId: 'donRec' },
      { name: 'Pendente', value: Number(resumoTotais.pendente || 0), gradId: 'donPen' },
      { name: 'Vencido', value: Number(dadosPendencias.valor_vencido || 0), gradId: 'donVen' },
    ].filter((r) => r.value > 0)
    return rows
  }, [semDadosFinanceiros, resumoTotais, dadosPendencias])

  const totalMensalidadesDonut = useMemo(
    () => mensalidadesDonutData.reduce((s, d) => s + d.value, 0),
    [mensalidadesDonutData]
  )

  const pacotesBarGradData = useMemo(() => {
    const t = resumoPacotes?.totais
    if (!t) return []
    return [
      { name: 'À vista', valor: Number(t.recebido_avista || 0), gradId: 'barPkg1' },
      { name: 'Entrada parcial', valor: Number(t.recebido_entradas_parcial || 0), gradId: 'barPkg2' },
      { name: 'Quitações', valor: Number(t.recebido_quitacoes || 0), gradId: 'barPkg3' },
    ].filter((d) => d.valor > 0)
  }, [resumoPacotes])

  const weeklyData = useMemo(() => {
    const raw = stats?.semana_por_dia
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((row) => ({
        name: row.name,
        atendimentos: Number(row.atendimentos ?? 0),
        concluidos: Number(row.concluidos ?? 0),
      }))
    }
    return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((name) => ({
      name,
      atendimentos: 0,
      concluidos: 0,
    }))
  }, [stats])

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Acesso Negado</h2>
        <p className="text-neutral-500 mb-4 max-w-xs">
          Você não tem permissão para acessar esta página.
        </p>
        <p className="text-sm text-neutral-400">Redirecionando...</p>
      </div>
    )
  }

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center animate-pulse">
          <Activity className="w-6 h-6 text-primary-500" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-40 bg-neutral-100 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-64 bg-neutral-100 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-neutral-100">
              <div className="w-12 h-12 bg-neutral-100 rounded-xl animate-pulse mb-3" />
              <div className="h-8 w-16 bg-neutral-100 rounded-lg animate-pulse mb-2" />
              <div className="h-3 w-24 bg-neutral-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-neutral-100 h-80">
              <div className="h-5 w-32 bg-neutral-100 rounded-lg animate-pulse mb-6" />
              <div className="h-48 bg-neutral-50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-sm font-medium text-neutral-700 mb-3">{error}</p>
        <button 
          onClick={loadStats}
          className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const hoje = new Date()
  const greeting = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight">
            {greeting} 
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Aqui está o resumo da sua clínica — {format(hoje, "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        <Link 
          href="/agenda"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Calendar className="w-4 h-4" />
          Ver Agenda
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Pacientes"
          value={stats?.total_pacientes || 0}
          subtitle={`${stats?.pacientes_ativos || 0} ativos`}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          href="/pacientes"
        />
        <StatCard
          title="Consultas Hoje"
          value={stats?.consultas_hoje || 0}
          subtitle={`${stats?.consultas_semana || 0} esta semana`}
          icon={CalendarCheck}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          href="/agenda"
        />
        <StatCard
          title="Faturamento"
          value={semDadosFinanceiros ? formatarValorCurto(stats?.faturamento_mes || 0) : formatarValorCurto(resumoTotais.pago)}
          subtitle={!semDadosFinanceiros ? `${resumoContadores.pago} pgtos` : 'este mês'}
          icon={DollarSign}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          href="/financeiro/mensalidades"
        />
        <StatCard
          title="Comparecimento"
          value={`${stats?.taxa_comparecimento?.toFixed(0) || 0}%`}
          subtitle="Este mês"
          icon={UserCheck}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-emerald-900/[0.08] bg-gradient-to-br from-white via-emerald-50/25 to-slate-50 shadow-[0_24px_60px_-28px_rgba(5,80,60,0.45)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{
              background: 'radial-gradient(ellipse 90% 60% at 100% 0%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(59,130,246,0.08), transparent 50%)',
            }}
          />
          <div className="relative flex flex-col gap-3 border-b border-neutral-200/70 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800/60">Centro financeiro</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">
                {abaFinanceiroDash === 'mensalidades' ? 'Mensalidades' : 'Pacotes'}
              </h3>
              <p className="text-xs text-neutral-500">
                {format(hoje, "MMMM yyyy", { locale: ptBR })} · visão do mês
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="flex rounded-xl bg-neutral-900/[0.06] p-1 ring-1 ring-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setAbaFinanceiroDash('mensalidades')}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    abaFinanceiroDash === 'mensalidades'
                      ? 'bg-white text-emerald-800 shadow-md shadow-emerald-900/10'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Mensalidades
                </button>
                <button
                  type="button"
                  onClick={() => setAbaFinanceiroDash('pacotes')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    abaFinanceiroDash === 'pacotes'
                      ? 'bg-white text-emerald-800 shadow-md shadow-emerald-900/10'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" /> Pacotes
                </button>
              </div>
              <div className="hidden h-8 w-px bg-neutral-200 sm:block" />
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
                <Link href="/financeiro/pacotes" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-emerald-800 hover:bg-white/80">
                  Pacotes <ArrowRight className="h-3 w-3" />
                </Link>
                <span className="text-neutral-200">·</span>
                <Link href="/financeiro/mensalidades" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-emerald-800 hover:bg-white/80">
                  Mensalidades <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          <div className="relative p-5 md:p-6">
            {abaFinanceiroDash === 'mensalidades' ? (
              semDadosFinanceiros ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/50 py-16 text-center">
                  <DollarSign className="mb-2 h-10 w-10 text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-600">Dados financeiros não disponíveis</p>
                  <Link href="/financeiro/mensalidades" className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
                    Abrir financeiro
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiMini icon={CheckCircle} label="Recebido" value={formatarValorCurto(resumoTotais.pago)} sub={`${resumoContadores.pago} pagamentos`} accent="emerald" />
                    <KpiMini icon={Clock} label="Pendente" value={formatarValorCurto(resumoTotais.pendente)} sub={`${resumoContadores.pendente} em aberto`} accent="amber" />
                    <KpiMini icon={AlertCircle} label="Vencido" value={formatarValorCurto(dadosPendencias.valor_vencido)} sub={`${dadosPendencias.total_vencidos} títulos`} accent="rose" />
                    <KpiMini icon={DollarSign} label="Contratado" value={formatarValorCurto(resumoTotais.total)} sub={`${resumoContadores.total} no mês`} accent="slate" />
                  </div>
                  <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
                    <div className="relative flex min-h-[240px] items-center justify-center rounded-2xl border border-white/80 bg-white/60 p-2 shadow-inner shadow-emerald-900/[0.06] lg:col-span-5">
                      {mensalidadesDonutData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <defs>
                                <linearGradient id="donRec" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#6ee7b7" />
                                  <stop offset="100%" stopColor="#059669" />
                                </linearGradient>
                                <linearGradient id="donPen" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#fde68a" />
                                  <stop offset="100%" stopColor="#d97706" />
                                </linearGradient>
                                <linearGradient id="donVen" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#fecdd3" />
                                  <stop offset="100%" stopColor="#e11d48" />
                                </linearGradient>
                              </defs>
                              <Pie
                                data={mensalidadesDonutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={72}
                                outerRadius={108}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="#fff"
                                strokeWidth={2}
                              >
                                {mensalidadesDonutData.map((entry) => (
                                  <Cell key={entry.gradId} fill={`url(#${entry.gradId})`} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip formatter={formatarValor} />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Fluxo</span>
                            <span className="text-lg font-bold tabular-nums text-neutral-900">{formatarValorCurto(totalMensalidadesDonut)}</span>
                            <span className="text-[10px] text-neutral-500">soma no período</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-neutral-500">Sem valores para exibir</p>
                      )}
                    </div>
                    <div className="flex min-h-[240px] flex-col justify-center rounded-2xl border border-white/80 bg-white/50 p-3 shadow-inner lg:col-span-7">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Composição (barras)</p>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={financeiroChartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <defs>
                              <linearGradient id="barRec" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6ee7b7" />
                                <stop offset="100%" stopColor="#059669" />
                              </linearGradient>
                              <linearGradient id="barPen" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#fde68a" />
                                <stop offset="100%" stopColor="#d97706" />
                              </linearGradient>
                              <linearGradient id="barVen" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#fecdd3" />
                                <stop offset="100%" stopColor="#e11d48" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={72}
                              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip formatter={formatarValor} />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                            <Bar dataKey="valor" radius={[0, 10, 10, 0]} barSize={22}>
                              {financeiroChartData.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    entry.name === 'Recebido'
                                      ? 'url(#barRec)'
                                      : entry.name === 'Pendente'
                                        ? 'url(#barPen)'
                                        : 'url(#barVen)'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : semDadosPacotesMes && !statsPacotes ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/50 py-16 text-center">
                <Package className="mb-2 h-10 w-10 text-neutral-300" />
                <p className="text-sm font-medium text-neutral-600">Não foi possível carregar pacotes</p>
                <Link href="/financeiro/pacotes" className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
                  Abrir pacotes
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <KpiMini
                    icon={CheckCircle}
                    label="Recebido (mês)"
                    value={formatarValorCurto(Number(pacotesTotaisMes.recebido_mes || 0))}
                    sub="Entradas no período"
                    accent="emerald"
                  />
                  <KpiMini
                    icon={DollarSign}
                    label="À vista"
                    value={formatarValorCurto(Number(pacotesTotaisMes.recebido_avista || 0))}
                    accent="blue"
                  />
                  <KpiMini
                    icon={Clock}
                    label="Entradas parc."
                    value={formatarValorCurto(Number(pacotesTotaisMes.recebido_entradas_parcial || 0))}
                    accent="orange"
                  />
                  <KpiMini
                    icon={TrendingUp}
                    label="Quitações"
                    value={formatarValorCurto(Number(pacotesTotaisMes.recebido_quitacoes || 0))}
                    accent="slate"
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-7">
                    <div className="rounded-2xl border border-white/80 bg-white/55 p-3 shadow-inner">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Origem do recebimento</p>
                      <div className="h-[200px] w-full">
                        {pacotesBarGradData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={pacotesBarGradData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                              <defs>
                                <linearGradient id="barPkg1" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#86efac" />
                                  <stop offset="100%" stopColor="#16a34a" />
                                </linearGradient>
                                <linearGradient id="barPkg2" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#fdba74" />
                                  <stop offset="100%" stopColor="#ea580c" />
                                </linearGradient>
                                <linearGradient id="barPkg3" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#93c5fd" />
                                  <stop offset="100%" stopColor="#2563eb" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={formatarValor} />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                              <Bar dataKey="valor" radius={[0, 12, 12, 0]} barSize={24}>
                                {pacotesBarGradData.map((row) => (
                                  <Cell key={row.gradId} fill={`url(#${row.gradId})`} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full min-h-[140px] items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-500">
                            Nenhum recebimento de pacotes neste mês
                          </div>
                        )}
                      </div>
                    </div>
                    {pacotesMetodoPie.length > 0 && (
                      <div className="rounded-2xl border border-white/80 bg-white/55 p-3 shadow-inner">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Formas de pagamento</p>
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <defs>
                                {pacotesMetodoPie.map((entry, i) => (
                                  <linearGradient key={entry.gradId} id={entry.gradId} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.85} />
                                    <stop offset="100%" stopColor={CHART_COLORS[(i + 2) % CHART_COLORS.length]} stopOpacity={1} />
                                  </linearGradient>
                                ))}
                              </defs>
                              <Pie
                                data={pacotesMetodoPie}
                                cx="42%"
                                cy="50%"
                                innerRadius={48}
                                outerRadius={78}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="#fff"
                                strokeWidth={2}
                              >
                                {pacotesMetodoPie.map((entry) => (
                                  <Cell key={entry.gradId} fill={`url(#${entry.gradId})`} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip formatter={formatarValor} />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pacotesMetodoPie.map((row, i) => (
                            <span
                              key={row.name}
                              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-neutral-700"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              {row.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 lg:col-span-5">
                    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-orange-50/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-700" />
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-900">Saldo em aberto</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-amber-950">
                        {formatarValor(Number(statsPacotes?.valor_saldo_aberto_parcial || 0))}
                      </p>
                      <p className="mt-1 text-xs text-amber-900/80">
                        {statsPacotes?.total_pacotes_parcial ?? 0} pacote(s) com pagamento parcial
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-800" />
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-900">Acumulado (ativos)</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-950">
                        {formatarValor(Number(statsPacotes?.valor_total_recebido || 0))}
                      </p>
                      <p className="mt-1 text-xs text-emerald-900/80">Total já recebido em pacotes ativos</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status distribution - Donut */}
        <ChartCard title="Status de Hoje" subtitle="Distribuição de agendamentos">
          {statusChartData.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
                {statusChartData.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-neutral-600 truncate">{name}</span>
                    <span className="text-xs font-bold text-neutral-800 ml-auto">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Calendar className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-500">Nenhum agendamento hoje</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly activity chart */}
        <ChartCard
          title="Atendimentos da Semana"
          subtitle="Segunda a sábado · semana corrente (exc. cancelados)"
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <defs>
                  <linearGradient id="gradAtend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2D6A4F" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#868E96' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#868E96' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Area type="monotone" dataKey="atendimentos" name="Agendados" stroke="#2D6A4F" strokeWidth={2} fill="url(#gradAtend)" />
                <Area type="monotone" dataKey="concluidos" name="Concluídos" stroke="#3B82F6" strokeWidth={2} fill="url(#gradConc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Next appointments */}
        <ChartCard
          title="Próximos Agendamentos"
          subtitle="Agenda de hoje"
          action={
            <Link href="/agenda" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {stats?.proximos_agendamentos?.length > 0 ? (
              stats.proximos_agendamentos.slice(0, 6).map((ag, idx) => (
                <div key={ag.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-colors group animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{ag.paciente?.nome_completo}</p>
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        const date = parseDateSafe(ag.data_agendamento)
                        return date ? format(date, "dd/MM", { locale: ptBR }) : '—'
                      })()} · {formatTimeHHmm(ag.horario_inicio)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold
                    ${ag.status === 'confirmada' ? 'bg-blue-100 text-blue-700' :
                      ag.status === 'agendada' ? 'bg-yellow-100 text-yellow-700' :
                      ag.status === 'em_atendimento' ? 'bg-purple-100 text-purple-700' :
                      'bg-neutral-100 text-neutral-600'}`}>
                    {STATUS_LABELS[ag.status] || ag.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <CalendarCheck className="w-8 h-8 text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-500">Nenhum agendamento próximo</p>
                <Link href="/agenda" className="text-xs text-primary-600 hover:underline mt-1">
                  Ir para agenda
                </Link>
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
