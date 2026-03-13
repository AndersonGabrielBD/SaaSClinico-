'use client'

import { useEffect, useState } from 'react'
import { frequenciaService } from '@/services/frequenciaService'
import { 
  Calendar, 
  User, 
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  FileDown
} from 'lucide-react'
import Link from 'next/link'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import Toast from '@/components/common/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseDateSafe } from '@/lib/dateUtils'

export default function FrequenciaPage() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('profissional') // profissional | paciente
  const [expandedItems, setExpandedItems] = useState({})
  const [profissionalSelecionado, setProfissionalSelecionado] = useState('todos')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }
  
  // Filtro de período
  const hoje = new Date()
  const [mesAno, setMesAno] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`)

  useEffect(() => {
    loadDados()
  }, [mesAno])

  const loadDados = async () => {
    try {
      setLoading(true)
      const [ano, mes] = mesAno.split('-')
      const data = await frequenciaService.getResumoMensal(ano, mes)
      setDados(data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      showToast('Erro ao carregar dados de frequência', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Formatar período para exibição
  const getPeriodoLabel = () => {
    const [ano, mes] = mesAno.split('-')
    const data = new Date(parseInt(ano), parseInt(mes) - 1, 1)
    return format(data, "MMMM 'de' yyyy", { locale: ptBR })
  }

  // Função de exportação de PDF
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true)
      const [ano, mes] = mesAno.split('-')
      
      const response = await frequenciaService.exportPdf(ano, mes)
      
      // Criar link para download
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `frequencia_${mes}_${ano}.pdf`)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  const resumoPorProfissional = dados?.por_profissional || []
  const resumoPorPaciente = dados?.por_paciente || []

  // Filtrar por profissional selecionado primeiro
  let profissionaisFiltradosPorSelecao = resumoPorProfissional
  if (profissionalSelecionado && profissionalSelecionado !== 'todos') {
    profissionaisFiltradosPorSelecao = resumoPorProfissional.filter(
      p => p.profissional_id === profissionalSelecionado
    )
  }

  // Depois filtrar por busca de texto
  const profissionaisFiltrados = profissionaisFiltradosPorSelecao.filter(p => 
    p.profissional_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const pacientesFiltrados = resumoPorPaciente.filter(p => 
    p.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Totais gerais (baseado nos dados filtrados por select)
  const totalConsultas = profissionaisFiltradosPorSelecao.reduce((acc, p) => acc + p.total_consultas, 0)
  const totalProfissionais = profissionaisFiltradosPorSelecao.length
  const totalPacientes = resumoPorPaciente.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Controle de Frequência
          </h1>
          <p className="text-neutral-600 mt-1">
            Resumo de consultas para cálculo de pagamento dos profissionais
          </p>
        </div>
      </div>

      {/* Filtro de Período e Exportação */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="w-5 h-5 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">Período:</span>
            </div>
            <input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="w-full sm:w-auto min-w-0 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-lg font-semibold text-neutral-900 capitalize truncate">
              {getPeriodoLabel()}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto min-w-0 flex-shrink-0">
            <select
              value={profissionalSelecionado || 'todos'}
              onChange={(e) => setProfissionalSelecionado(e.target.value === 'todos' ? null : e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Histórico  Completo</option>
              {resumoPorProfissional.map(prof => (
                <option key={prof.profissional_id} value={prof.profissional_id}>
                  {prof.profissional_nome}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              className="w-full md:w-auto min-w-0 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{exportingPdf ? 'Gerando...' : 'Exportar PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Total de Consultas</p>
              <p className="text-3xl font-bold text-neutral-900">{totalConsultas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Profissionais Ativos</p>
              <p className="text-3xl font-bold text-neutral-900">{totalProfissionais}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Pacientes Atendidos</p>
              <p className="text-3xl font-bold text-neutral-900">{totalPacientes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs para alternar visualização */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="border-b border-neutral-200">
          <div className="flex">
            <button
              onClick={() => setViewMode('profissional')}
              className={`px-6 py-3 font-medium transition-colors ${
                viewMode === 'profissional'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Por Profissional
            </button>
            <button
              onClick={() => setViewMode('paciente')}
              className={`px-6 py-3 font-medium transition-colors ${
                viewMode === 'paciente'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Por Paciente
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="p-4 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder={viewMode === 'profissional' ? 'Buscar profissional...' : 'Buscar paciente...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-4">
          {viewMode === 'profissional' ? (
            profissionaisFiltrados.length === 0 ? (
              <EmptyState 
                message={searchTerm ? "Nenhum profissional encontrado" : "Nenhum registro de frequência"} 
              />
            ) : (
              <div className="space-y-4">
                {profissionaisFiltrados.map((prof) => (
                  <div
                    key={prof.profissional_id}
                    className="border border-neutral-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(prof.profissional_id)}
                      className="w-full p-4 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-neutral-900">{prof.profissional_nome}</h3>
                          <p className="text-sm text-neutral-600">{prof.profissional_role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-neutral-500">Total de Consultas</p>
                          <p className="text-2xl font-bold text-primary-600">{prof.total_consultas}</p>
                        </div>
                        {expandedItems[prof.profissional_id] ? (
                          <ChevronUp className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {expandedItems[prof.profissional_id] && (
                      <div className="p-4 bg-white border-t border-neutral-200">
                        {prof.pacientes?.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="font-medium text-neutral-700 mb-3">
                              Pacientes Atendidos ({prof.pacientes.length})
                            </h4>
                            {prof.pacientes.map((pac, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-neutral-50 rounded-lg border border-neutral-200"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <Link
                                    href={`/pacientes/${pac.paciente_id}`}
                                    className="font-medium text-primary-600 hover:text-primary-700"
                                  >
                                    {pac.paciente_nome}
                                  </Link>
                                  <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-semibold">
                                    {pac.datas?.length || 0} {pac.datas?.length === 1 ? 'consulta' : 'consultas'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {pac.datas?.map((data, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 text-xs bg-white text-neutral-600 px-2 py-1 rounded border border-neutral-200"
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
                          <p className="text-neutral-500 text-center py-4">Nenhum paciente atendido</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            pacientesFiltrados.length === 0 ? (
              <EmptyState 
                message={searchTerm ? "Nenhum paciente encontrado" : "Nenhum registro de frequência"} 
              />
            ) : (
              <div className="space-y-4">
                {pacientesFiltrados.map((pac) => (
                  <div
                    key={pac.paciente_id}
                    className="border border-neutral-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(pac.paciente_id)}
                      className="w-full p-4 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <Link
                            href={`/pacientes/${pac.paciente_id}`}
                            className="font-semibold text-neutral-900 hover:text-primary-600"
                          >
                            {pac.paciente_nome}
                          </Link>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-neutral-500">Total de Consultas</p>
                          <p className="text-2xl font-bold text-purple-600">{pac.total_consultas}</p>
                        </div>
                        {expandedItems[pac.paciente_id] ? (
                          <ChevronUp className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {expandedItems[pac.paciente_id] && (
                      <div className="p-4 bg-white border-t border-neutral-200">
                        {pac.profissionais?.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="font-medium text-neutral-700 mb-3">
                              Profissionais ({pac.profissionais.length})
                            </h4>
                            {pac.profissionais.map((prof, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-neutral-50 rounded-lg border border-neutral-200"
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
                                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                                    {prof.quantidade} {prof.quantidade === 1 ? 'consulta' : 'consultas'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {prof.datas?.map((data, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 text-xs bg-white text-neutral-600 px-2 py-1 rounded border border-neutral-200"
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
            )
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
