'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { frequenciaService } from '@/services/frequenciaService'
import {
  Calendar,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  FileDown,
  UserX,
} from 'lucide-react'
import Link from 'next/link'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import Toast from '@/components/common/Toast'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseDateSafe, getTodayBrazil } from '@/lib/dateUtils'

function defaultPeriodo() {
  const hoje = getTodayBrazil()
  const [y, m] = hoje.split('-').map(Number)
  const ini = format(new Date(y, m - 1, 1), 'yyyy-MM-dd')
  const fim = format(endOfMonth(new Date(y, m - 1, 1)), 'yyyy-MM-dd')
  return { dataInicio: ini, dataFim: fim }
}

export default function FrequenciaPage() {
  const defaults = useMemo(() => defaultPeriodo(), [])
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  /** presenças: por profissional | paciente; faltas: mesma estrutura de dados */
  const [viewMode, setViewMode] = useState('profissional')
  const [tipoRegistro, setTipoRegistro] = useState('presencas') // presencas | faltas
  const [expandedItems, setExpandedItems] = useState({})
  const [profissionalSelecionado, setProfissionalSelecionado] = useState('todos')
  const [dataInicio, setDataInicio] = useState(defaults.dataInicio)
  const [dataFim, setDataFim] = useState(defaults.dataFim)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  const somenteFaltas = tipoRegistro === 'faltas'

  const loadDados = useCallback(async () => {
    if (!dataInicio || !dataFim) return
    if (dataInicio > dataFim) {
      showToast('Data início não pode ser maior que data fim', 'error')
      return
    }
    try {
      setLoading(true)
      const data = await frequenciaService.getResumoMensal({
        dataInicio,
        dataFim,
        somenteFaltas,
      })
      setDados(data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      showToast('Erro ao carregar dados de frequência', 'error')
    } finally {
      setLoading(false)
    }
  }, [dataInicio, dataFim, somenteFaltas])

  useEffect(() => {
    loadDados()
  }, [loadDados])

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getPeriodoLabel = () => {
    try {
      const a = parseDateSafe(dataInicio)
      const b = parseDateSafe(dataFim)
      if (a && b) {
        return `${format(a, "dd MMM yyyy", { locale: ptBR })} — ${format(b, "dd MMM yyyy", { locale: ptBR })}`
      }
    } catch (_) {}
    return `${dataInicio} a ${dataFim}`
  }

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true)
      const response = await frequenciaService.exportPdf({
        dataInicio,
        dataFim,
        somenteFaltas,
      })
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `frequencia_${dataInicio}_a_${dataFim}${somenteFaltas ? '_faltas' : ''}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('PDF gerado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      showToast('Erro ao exportar relatório em PDF', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading && !dados) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  const resumoPorProfissional = dados?.por_profissional || []
  const resumoPorPaciente = dados?.por_paciente || []

  let profissionaisFiltradosPorSelecao = resumoPorProfissional
  if (profissionalSelecionado && profissionalSelecionado !== 'todos') {
    profissionaisFiltradosPorSelecao = resumoPorProfissional.filter(
      p => p.profissional_id === profissionalSelecionado
    )
  }

  const profissionaisFiltrados = profissionaisFiltradosPorSelecao.filter(p =>
    p.profissional_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pacientesFiltrados = resumoPorPaciente.filter(p =>
    p.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalEventos = profissionaisFiltradosPorSelecao.reduce((acc, p) => acc + p.total_consultas, 0)
  const totalProfissionais = profissionaisFiltradosPorSelecao.length
  const totalPacientes = resumoPorPaciente.length

  const labelEvento = somenteFaltas ? 'faltas' : 'consultas'
  const labelEventoSing = somenteFaltas ? 'falta' : 'consulta'

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="page-title">
            Controle de Frequência
          </h1>
          <p className="page-subtitle">
            Resumo por período para pagamento e acompanhamento de presenças e faltas
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-card border border-neutral-100 overflow-hidden animate-fade-in">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col lg:flex-row flex-wrap gap-3 lg:items-end">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="w-5 h-5 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">Período</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1 min-w-0">
              <label className="text-xs text-neutral-500 sm:hidden">Início</label>
              <input
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-white outline-none transition-all duration-150 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <span className="text-neutral-400 text-sm hidden sm:inline">até</span>
              <label className="text-xs text-neutral-500 sm:hidden">Fim</label>
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-white outline-none transition-all duration-150 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <p className="text-sm font-medium text-neutral-700 capitalize lg:ml-2 truncate">
              {getPeriodoLabel()}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full flex-wrap">
            <select
              value={profissionalSelecionado}
              onChange={(e) => setProfissionalSelecionado(e.target.value)}
              className="select-field w-full min-w-0 sm:w-auto sm:min-w-[200px]"
            >
              <option value="todos">Todos os profissionais</option>
              {resumoPorProfissional.map(prof => (
                <option key={prof.profissional_id} value={prof.profissional_id}>
                  {prof.profissional_nome}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading || dataInicio > dataFim}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-primary-500 text-white rounded-xl hover:bg-primary-600 hover:shadow-md active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap shadow-sm"
            >
              <FileDown className="w-4 h-4 flex-shrink-0" />
              {exportingPdf ? 'Gerando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${somenteFaltas ? 'bg-orange-100' : 'bg-blue-100'}`}>
              {somenteFaltas ? <UserX className="w-6 h-6 text-orange-600" /> : <Calendar className="w-6 h-6 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm text-neutral-500">Total no período</p>
              <p className="text-3xl font-bold text-neutral-900">{totalEventos}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{somenteFaltas ? 'Registros de falta' : 'Atendimentos (compareceu)'}</p>
            </div>
          </div>
        </div>

        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-100">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Profissionais</p>
              <p className="text-3xl font-bold text-neutral-900">{totalProfissionais}</p>
            </div>
          </div>
        </div>

        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Pacientes</p>
              <p className="text-3xl font-bold text-neutral-900">{totalPacientes}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-neutral-100 overflow-hidden animate-fade-in">
        <div className="border-b border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2 pt-2">
            <div className="flex flex-wrap">
              <button
                type="button"
                onClick={() => setTipoRegistro('presencas')}
                className={`px-4 py-3 text-sm font-medium transition-colors rounded-xl ${
                  tipoRegistro === 'presencas'
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Presenças
              </button>
              <button
                type="button"
                onClick={() => setTipoRegistro('faltas')}
                className={`px-4 py-3 text-sm font-medium transition-colors rounded-xl flex items-center gap-1.5 ${
                  tipoRegistro === 'faltas'
                    ? 'text-orange-700 border-b-2 border-orange-500 bg-orange-50/50'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <UserX className="w-4 h-4" />
                Faltas
              </button>
            </div>
            <p className="text-xs text-neutral-500 px-2 pb-2 sm:pb-0">
              {tipoRegistro === 'faltas'
                ? 'Registros em que o paciente não compareceu (frequência com compareceu = não).'
                : 'Atendimentos em que o paciente compareceu.'}
            </p>
          </div>
          <div className="flex border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setViewMode('profissional')}
              className={`px-6 py-3 font-medium transition-colors rounded-xl flex-1 sm:flex-none ${
                viewMode === 'profissional'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Por Profissional
            </button>
            <button
              type="button"
              onClick={() => setViewMode('paciente')}
              className={`px-6 py-3 font-medium transition-colors rounded-xl flex-1 sm:flex-none ${
                viewMode === 'paciente'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Por Paciente
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-neutral-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder={viewMode === 'profissional' ? 'Buscar profissional...' : 'Buscar paciente...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : viewMode === 'profissional' ? (
            profissionaisFiltrados.length === 0 ? (
              <EmptyState
                message={searchTerm ? 'Nenhum profissional encontrado' : `Nenhum registro de ${labelEvento}`}
              />
            ) : (
              <div className="space-y-4">
                {profissionaisFiltrados.map((prof) => (
                  <div
                    key={prof.profissional_id}
                    className="border border-neutral-100 rounded-2xl overflow-hidden animate-fade-in"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(prof.profissional_id)}
                      className="w-full p-4 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary-100 rounded-xl flex-shrink-0">
                          <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-neutral-900 truncate">{prof.profissional_nome}</h3>
                          <p className="text-sm text-neutral-600 truncate">
                            {prof.profissional_role || prof.especialidade || 'Profissional'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm text-neutral-500">
                            Total de {somenteFaltas ? 'faltas' : 'consultas'}
                          </p>
                          <p className={`text-2xl font-bold ${somenteFaltas ? 'text-orange-600' : 'text-primary-600'}`}>
                            {prof.total_consultas}
                          </p>
                        </div>
                        {expandedItems[prof.profissional_id] ? (
                          <ChevronUp className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {expandedItems[prof.profissional_id] && (
                      <div className="p-4 bg-white border-t border-neutral-100">
                        {prof.pacientes?.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="font-medium text-neutral-700 mb-3">
                              Pacientes ({prof.pacientes.length})
                            </h4>
                            {prof.pacientes.map((pac, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <Link
                                    href={`/pacientes/${pac.paciente_id}`}
                                    className="font-medium text-primary-600 hover:text-primary-700"
                                  >
                                    {pac.paciente_nome}
                                  </Link>
                                  <span className={`px-2 py-1 rounded-lg text-sm font-semibold ${somenteFaltas ? 'bg-orange-100 text-orange-800' : 'bg-primary-100 text-primary-700'}`}>
                                    {pac.datas?.length || 0}{' '}
                                    {(pac.datas?.length === 1 ? labelEventoSing : labelEvento)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {pac.datas?.map((data, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-xs bg-white text-neutral-600 px-2 py-1 rounded-lg border border-neutral-100"
                                    >
                                      <Calendar className="w-3 h-3" />
                                      {(() => {
                                        const date = parseDateSafe(data)
                                        return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                                      })()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-neutral-500 text-center py-4">Nenhum paciente neste período</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : pacientesFiltrados.length === 0 ? (
            <EmptyState
              message={searchTerm ? 'Nenhum paciente encontrado' : `Nenhum registro de ${labelEvento}`}
            />
          ) : (
            <div className="space-y-4">
              {pacientesFiltrados.map((pac) => (
                <div
                  key={pac.paciente_id}
                  className="border border-neutral-100 rounded-2xl overflow-hidden animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(pac.paciente_id)}
                    className="w-full p-4 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-purple-100 rounded-xl flex-shrink-0">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/pacientes/${pac.paciente_id}`}
                          className="font-semibold text-neutral-900 hover:text-primary-600 block truncate"
                        >
                          {pac.paciente_nome}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">Total</p>
                        <p className={`text-2xl font-bold ${somenteFaltas ? 'text-orange-600' : 'text-purple-600'}`}>
                          {pac.total_consultas}
                        </p>
                      </div>
                      {expandedItems[pac.paciente_id] ? (
                        <ChevronUp className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                  </button>

                  {expandedItems[pac.paciente_id] && (
                    <div className="p-4 bg-white border-t border-neutral-100">
                      {pac.profissionais?.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-medium text-neutral-700 mb-3">
                            Profissionais ({pac.profissionais.length})
                          </h4>
                          {pac.profissionais.map((prof, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-neutral-900">
                                    {prof.profissional_nome}
                                  </p>
                                  <p className="text-sm text-neutral-600">
                                    {prof.especialidade || 'Profissional'}
                                  </p>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${somenteFaltas ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-700'}`}>
                                  {prof.quantidade}{' '}
                                  {prof.quantidade === 1 ? labelEventoSing : labelEvento}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {prof.datas?.map((data, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 text-xs bg-white text-neutral-600 px-2 py-1 rounded-lg border border-neutral-100"
                                  >
                                    <Calendar className="w-3 h-3" />
                                    {(() => {
                                      const date = parseDateSafe(data)
                                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                                    })()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-center py-4">Nenhum profissional associado</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  )
}
