'use client'

import { useState, useEffect } from 'react'
import { agendamentoService } from '@/services/agendamentoService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { getUserRole } from '@/utils/auth'
import * as api from '@/lib/api'
import Button from '@/components/common/Button'

export default function AgendamentoForm({ agendamento, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [salas, setSalas] = useState([])

  const [formData, setFormData] = useState({
    paciente_id: agendamento?.paciente_id || '',
    profissional_id: agendamento?.profissional_id || '',
    sala_id: agendamento?.sala_id || '',
    data_agendamento: agendamento?.data_agendamento || new Date().toISOString().split('T')[0],
    horario_inicio: agendamento?.horario_inicio || '',
    horario_fim: agendamento?.horario_fim || '',
    tipo_atendimento: agendamento?.tipo_atendimento || 'Avaliação',
    observacoes: agendamento?.observacoes || ''
  })

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const userRole = getUserRole()
      const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
      
      // Carregar pacientes
      let pacientesData
      if (isProfissional) {
        pacientesData = await profissionalService.getMyPacientes({ ativo: true })
      } else {
        pacientesData = await pacienteService.getAll({ ativo: true })
      }
      setPacientes(pacientesData)

      // Carregar profissionais
      const profData = await api.getProfissionais({ ativo: true })
      setProfissionais(profData?.data || profData || [])

      // Carregar salas
      const salasData = await api.getSalas({ ativo: true })
      setSalas(salasData?.data || salasData || [])
    } catch (error) {
      console.error('Erro ao carregar opções:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validações
    if (!formData.paciente_id || !formData.profissional_id || !formData.data_agendamento || 
        !formData.horario_inicio || !formData.horario_fim) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    if (formData.horario_inicio >= formData.horario_fim) {
      setError('Horário de término deve ser maior que o horário de início')
      return
    }

    try {
      setLoading(true)

      // Verificar conflitos
      const hasConflict = await agendamentoService.checkConflict({
        profissional_id: formData.profissional_id,
        sala_id: formData.sala_id,
        data_agendamento: formData.data_agendamento,
        horario_inicio: formData.horario_inicio,
        horario_fim: formData.horario_fim
      })

      if (hasConflict) {
        setError('Há conflito de horário com outro agendamento')
        return
      }

      if (agendamento) {
        await agendamentoService.update(agendamento.id, formData)
      } else {
        await agendamentoService.create(formData)
      }

      onSuccess()
    } catch (err) {
      setError(err.message || 'Erro ao salvar agendamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Paciente */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Paciente *
          </label>
          <select
            value={formData.paciente_id}
            onChange={(e) => setFormData({ ...formData, paciente_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          >
            <option value="">Selecione um paciente</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_completo}
              </option>
            ))}
          </select>
        </div>

        {/* Profissional */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Profissional *
          </label>
          <select
            value={formData.profissional_id}
            onChange={(e) => setFormData({ ...formData, profissional_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          >
            <option value="">Selecione um profissional</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_completo} {p.especialidade && `- ${p.especialidade}`}
              </option>
            ))}
          </select>
        </div>

        {/* Sala */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Sala
          </label>
          <select
            value={formData.sala_id}
            onChange={(e) => setFormData({ ...formData, sala_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Selecione uma sala</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Atendimento */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Tipo de Atendimento
          </label>
          <select
            value={formData.tipo_atendimento}
            onChange={(e) => setFormData({ ...formData, tipo_atendimento: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option>Avaliação</option>
            <option>Reavaliação</option>
            <option>Seguimento</option>
            <option>Terapia</option>
            <option>Retorno</option>
          </select>
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Data *
          </label>
          <input
            type="date"
            value={formData.data_agendamento}
            onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>

        {/* Horário Início */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Horário Início *
          </label>
          <input
            type="time"
            value={formData.horario_inicio}
            onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>

        {/* Horário Fim */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Horário Fim *
          </label>
          <input
            type="time"
            value={formData.horario_fim}
            onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Observações
        </label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Observações adicionais..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} className="flex-1">
          {agendamento ? 'Atualizar' : 'Criar'} Agendamento
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
