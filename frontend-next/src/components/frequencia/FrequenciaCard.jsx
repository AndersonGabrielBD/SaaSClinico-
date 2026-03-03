'use client'

import { useState, useEffect } from 'react'
import { frequenciaService } from '@/services/frequenciaService'
import { useAuth } from '@/context/AuthContext'
import { Calendar, CheckCircle, XCircle, TrendingUp, User } from 'lucide-react'

export default function FrequenciaCard({ pacienteId }) {
  const { user } = useAuth()
  const [estatisticas, setEstatisticas] = useState(null)
  const [estatisticasPorProfissional, setEstatisticasPorProfissional] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [formData, setFormData] = useState({
    data_atendimento: new Date().toISOString().split('T')[0],
    compareceu: true,
    observacoes: ''
  })

  useEffect(() => {
    loadEstatisticas()
  }, [pacienteId])

  const loadEstatisticas = async () => {
    try {
      setLoading(true)
      const [stats, statsPorProf] = await Promise.all([
        frequenciaService.getEstatisticas({ paciente_id: pacienteId }),
        frequenciaService.getEstatisticasPorProfissional(pacienteId)
      ])
      setEstatisticas(stats)
      setEstatisticasPorProfissional(statsPorProf)
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrar = async (e) => {
    e.preventDefault()
    
    if (!user?.id) {
      alert('Erro: Usuário não autenticado')
      return
    }
    
    try {
      await frequenciaService.registrar({
        paciente_id: pacienteId,
        profissional_id: user.id,
        data_atendimento: formData.data_atendimento,
        compareceu: formData.compareceu === 'true' || formData.compareceu === true,
        observacoes: formData.observacoes || null
      })
      
      alert('Frequência registrada com sucesso!')
      setShowRegistroModal(false)
      setFormData({
        data_atendimento: new Date().toISOString().split('T')[0],
        compareceu: true,
        observacoes: ''
      })
      loadEstatisticas()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao registrar frequência')
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Frequência de Atendimentos</h3>
        <button
          onClick={() => setShowRegistroModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Registrar Frequência
        </button>
      </div>

      {/* Estatísticas Gerais */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total de Consultas</p>
                <p className="text-2xl font-bold">{estatisticas.total_consultas}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Comparecimentos</p>
                <p className="text-2xl font-bold">{estatisticas.total_comparecimentos}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Taxa de Presença</p>
                <p className="text-2xl font-bold">{estatisticas.taxa_presenca}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estatísticas por Profissional */}
      {estatisticasPorProfissional.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            Frequência por Profissional
          </h4>
          <div className="space-y-3">
            {estatisticasPorProfissional.map((prof) => (
              <div key={prof.profissional_id} className="border border-neutral-200 rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">{prof.profissional_nome}</p>
                  <span className="text-sm font-semibold text-primary-600">
                    {prof.taxa_presenca}%
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-neutral-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {prof.total_consultas} consultas
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {prof.total_comparecimentos} presenças
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    {prof.total_faltas} faltas
                  </span>
                </div>
                <div className="mt-2 bg-neutral-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-600 h-full" 
                    style={{ width: `${prof.taxa_presenca}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Registro */}
      {showRegistroModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Registrar Frequência</h2>
            
            {/* Info do profissional */}
            {user && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <div className="text-sm">
                  <p className="text-neutral-600">Registrado por:</p>
                  <p className="font-medium text-neutral-900">{user.nome || user.email}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleRegistrar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Data do Atendimento
                </label>
                <input
                  type="date"
                  value={formData.data_atendimento}
                  onChange={(e) => setFormData({ ...formData, data_atendimento: e.target.value })}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Não pode ser uma data futura
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Compareceu?
                </label>
                <select
                  value={formData.compareceu}
                  onChange={(e) => setFormData({ ...formData, compareceu: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={true}>Sim</option>
                  <option value={false}>Não</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Adicione observações sobre o atendimento..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistroModal(false)
                    setFormData({
                      data_atendimento: new Date().toISOString().split('T')[0],
                      compareceu: true,
                      observacoes: ''
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
