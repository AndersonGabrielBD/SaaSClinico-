'use client'

import { useEffect, useState } from 'react'
import { frequenciaService } from '@/services/frequenciaService'
import { 
  Calendar, 
  User, 
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseDateSafe } from '@/lib/dateUtils'

export default function FrequenciaPage() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('profissional') // profissional | paciente
  const [expandedItems, setExpandedItems] = useState({})
  
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

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  const resumoPorProfissional = dados?.por_profissional || []
  const resumoPorPaciente = dados?.por_paciente || []

  // Filtrar por busca
  const profissionaisFiltrados = resumoPorProfissional.filter(p => 
    p.profissional_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const pacientesFiltrados = resumoPorPaciente.filter(p => 
    p.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Totais gerais
  const totalConsultas = resumoPorProfissional.reduce((acc, p) => acc + p.total_consultas, 0)
  const totalProfissionais = resumoPorProfissional.length
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

      {/* Filtro de Período */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">Período:</span>
          </div>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-lg font-semibold text-neutral-900 capitalize">
            {getPeriodoLabel()}
          </span>
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

      {/* Toggle de Visualização + Busca */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Toggle */}
          <div className="flex bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('profissional')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'profissional'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Por Profissional
            </button>
            <button
              onClick={() => setViewMode('paciente')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'paciente'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <User className="w-4 h-4" />
              Por Paciente
            </button>
          </div>

          {/* Busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder={viewMode === 'profissional' ? 'Buscar profissional...' : 'Buscar paciente...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* VISÃO POR PROFISSIONAL - Para cálculo de pagamento */}
      {viewMode === 'profissional' && (
        <div className="space-y-4">
          {profissionaisFiltrados.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="Nenhum registro encontrado"
              description={`Não há consultas registradas em ${getPeriodoLabel()}.`}
            />
          ) : (
            profissionaisFiltrados.map((prof) => (
              <div 
                key={prof.profissional_id}
                className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden"
              >
                {/* Header do Profissional */}
                <div 
                  className="p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  onClick={() => toggleExpand(`prof-${prof.profissional_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-lg">
                          {prof.profissional_nome}
                        </h3>
                        <p className="text-sm text-neutral-500">
                          {prof.especialidade || 'Profissional'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">Total de Consultas</p>
                        <p className="text-2xl font-bold text-green-600">
                          {prof.total_consultas}
                        </p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm text-neutral-500">Pacientes</p>
                        <p className="text-xl font-semibold text-neutral-700">
                          {prof.pacientes?.length || 0}
                        </p>
                      </div>
                      {expandedItems[`prof-${prof.profissional_id}`] 
                        ? <ChevronUp className="w-5 h-5 text-neutral-400" />
                        : <ChevronDown className="w-5 h-5 text-neutral-400" />
                      }
                    </div>
                  </div>
                </div>

                {/* Detalhes expandidos - Lista de pacientes atendidos */}
                {expandedItems[`prof-${prof.profissional_id}`] && prof.pacientes && (
                  <div className="border-t border-neutral-200 bg-neutral-50">
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-neutral-600 mb-3">
                        Pacientes Atendidos em {getPeriodoLabel()}
                      </h4>
                      <div className="space-y-3">
                        {prof.pacientes.map((pac) => (
                          <div 
                            key={pac.paciente_id}
                            className="bg-white rounded-lg p-4 border border-neutral-200"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <Link 
                                href={`/pacientes/${pac.paciente_id}`}
                                className="font-medium text-neutral-900 hover:text-primary-600"
                              >
                                {pac.paciente_nome}
                              </Link>
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                                {pac.quantidade} {pac.quantidade === 1 ? 'consulta' : 'consultas'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pac.datas?.map((data, idx) => (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded"
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
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* VISÃO POR PACIENTE */}
      {viewMode === 'paciente' && (
        <div className="space-y-4">
          {pacientesFiltrados.length === 0 ? (
            <EmptyState
              icon={<User className="w-12 h-12" />}
              title="Nenhum registro encontrado"
              description={`Não há consultas registradas em ${getPeriodoLabel()}.`}
            />
          ) : (
            pacientesFiltrados.map((pac) => (
              <div 
                key={pac.paciente_id}
                className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden"
              >
                {/* Header do Paciente */}
                <div 
                  className="p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  onClick={() => toggleExpand(`pac-${pac.paciente_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <Link 
                          href={`/pacientes/${pac.paciente_id}`}
                          className="font-semibold text-neutral-900 text-lg hover:text-primary-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pac.paciente_nome}
                        </Link>
                        <p className="text-sm text-neutral-500">
                          {pac.profissionais?.length || 0} profissional(is)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">Total</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {pac.total_consultas}
                        </p>
                      </div>
                      {expandedItems[`pac-${pac.paciente_id}`] 
                        ? <ChevronUp className="w-5 h-5 text-neutral-400" />
                        : <ChevronDown className="w-5 h-5 text-neutral-400" />
                      }
                    </div>
                  </div>
                </div>

                {/* Detalhes expandidos - Profissionais que atenderam */}
                {expandedItems[`pac-${pac.paciente_id}`] && pac.profissionais && (
                  <div className="border-t border-neutral-200 bg-neutral-50">
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-neutral-600 mb-3">
                        Consultas por Profissional
                      </h4>
                      <div className="space-y-3">
                        {pac.profissionais.map((prof) => (
                          <div 
                            key={prof.profissional_id}
                            className="bg-white rounded-lg p-4 border border-neutral-200"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-neutral-900">
                                  {prof.profissional_nome}
                                </p>
                                <p className="text-sm text-neutral-500">
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
                                  className="inline-flex items-center gap-1 text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded"
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
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
