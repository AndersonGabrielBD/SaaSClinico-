'use client'

import { useState, useEffect } from 'react'
import { prontuarioService } from '@/services/prontuarioService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { getUserRole } from '@/utils/auth'
import Button from '@/components/common/Button'

export default function ProntuarioForm({ 
  prontuario, 
  initialPacienteId,
  onSuccess, 
  onCancel 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pacientes, setPacientes] = useState([])

  const [formData, setFormData] = useState({
    paciente_id: prontuario?.paciente_id || initialPacienteId || '',
    titulo: prontuario?.titulo || '',
    descricao: prontuario?.descricao || '',
    queixas: prontuario?.queixas || '',
    diagnostico_preliminar: prontuario?.diagnostico_preliminar || '',
    historico_clinico: prontuario?.historico_clinico || '',
    alergias: prontuario?.alergias || '',
    medicacoes: prontuario?.medicacoes || ''
  })

  useEffect(() => {
    loadPacientes()
  }, [])

  const loadPacientes = async () => {
    try {
      const userRole = getUserRole()
      const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
      
      // Profissionais veem apenas seus pacientes vinculados
      let data
      if (isProfissional) {
        data = await profissionalService.getMyPacientes({ ativo: true })
      } else {
        data = await pacienteService.getAll({ ativo: true })
      }
      
      setPacientes(data)
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    console.log('📝 [FORM] Iniciando submit do formulário')
    console.log('📝 [FORM] Dados do formulário:', formData)

    if (!formData.paciente_id || !formData.titulo) {
      const errorMsg = 'Paciente e título são obrigatórios'
      console.error('❌ [FORM] Validação falhou:', errorMsg)
      setError(errorMsg)
      return
    }

    try {
      setLoading(true)
      console.log('📝 [FORM] Enviando para o service...')

      if (prontuario) {
        console.log('📝 [FORM] Atualizando prontuário:', prontuario.id)
        await prontuarioService.update(prontuario.id, formData)
      } else {
        console.log('📝 [FORM] Criando novo prontuário')
        const result = await prontuarioService.create(formData)
        console.log('✅ [FORM] Prontuário criado:', result)
      }

      console.log('✅ [FORM] Operação concluída com sucesso')
      onSuccess()
    } catch (err) {
      console.error('❌ [FORM] Erro ao salvar:', err)
      console.error('❌ [FORM] Mensagem:', err.message)
      console.error('❌ [FORM] Stack:', err.stack)
      console.error('❌ [FORM] Response:', err.response)
      setError(err.message || 'Erro ao salvar prontuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Paciente e Título */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Paciente *
          </label>
          <select
            value={formData.paciente_id}
            onChange={(e) => setFormData({ ...formData, paciente_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
            disabled={!!prontuario}
          >
            <option value="">Selecione um paciente</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_completo}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Título do Prontuário *
          </label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Ex: Avaliação Inicial, Seguimento Mensal, etc."
            required
          />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Descrição
        </label>
        <textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Descrição geral do prontuário..."
        />
      </div>

      {/* Queixas */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Queixas
        </label>
        <textarea
          value={formData.queixas}
          onChange={(e) => setFormData({ ...formData, queixas: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Descreva as queixas principais do paciente..."
        />
      </div>

      {/* Diagnóstico Preliminar */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Diagnóstico Preliminar
        </label>
        <textarea
          value={formData.diagnostico_preliminar}
          onChange={(e) => setFormData({ ...formData, diagnostico_preliminar: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Diagnóstico inicial do paciente..."
        />
      </div>

      {/* Histórico Clínico */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Histórico Clínico
        </label>
        <textarea
          value={formData.historico_clinico}
          onChange={(e) => setFormData({ ...formData, historico_clinico: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Histórico médico relevante, cirurgias anteriores, condições preexistentes..."
        />
      </div>

      {/* Alergias e Medicações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Alergias
          </label>
          <textarea
            value={formData.alergias}
            onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Liste as alergias conhecidas..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Medicações em Uso
          </label>
          <textarea
            value={formData.medicacoes}
            onChange={(e) => setFormData({ ...formData, medicacoes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Medicações atuais do paciente..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} className="flex-1">
          {prontuario ? 'Atualizar' : 'Criar'} Prontuário
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
