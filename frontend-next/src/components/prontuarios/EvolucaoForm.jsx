'use client'

import { useState } from 'react'
import { prontuarioService } from '@/services/prontuarioService'
import Button from '@/components/common/Button'

export default function EvolucaoForm({ 
  prontuarioId,
  evolucao, 
  onSuccess, 
  onCancel 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    prontuario_id: prontuarioId,
    conteudo: evolucao?.conteudo || '',
    titulo_resumo: evolucao?.titulo_resumo || '',
    observacoes_confidenciais: evolucao?.observacoes_confidenciais || ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.conteudo) {
      setError('Conteúdo é obrigatório')
      return
    }

    try {
      setLoading(true)

      if (evolucao) {
        await prontuarioService.updateEvolucao(prontuarioId, evolucao.id, formData)
      } else {
        await prontuarioService.createEvolucao(prontuarioId, formData)
      }

      onSuccess()
    } catch (err) {
      setError(err.message || 'Erro ao salvar evolução')
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

      {/* Título Resumo */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Título/Resumo
        </label>
        <input
          type="text"
          value={formData.titulo_resumo}
          onChange={(e) => setFormData({ ...formData, titulo_resumo: e.target.value })}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Ex: Consulta de Retorno, Avaliação Audiológica, etc."
        />
      </div>

      {/* Conteúdo */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Descrição da Evolução *
        </label>
        <textarea
          value={formData.conteudo}
          onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
          rows={10}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
          placeholder="Descreva detalhadamente a evolução do paciente, observações, procedimentos realizados, etc."
          required
        />
        <p className="text-xs text-neutral-500 mt-1">
          Esta informação será registrada no histórico do paciente
        </p>
      </div>

      {/* Observações Confidenciais */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Observações Confidenciais (Uso Interno)
        </label>
        <textarea
          value={formData.observacoes_confidenciais}
          onChange={(e) => setFormData({ ...formData, observacoes_confidenciais: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Observações que não devem ser compartilhadas com o paciente..."
        />
        <p className="text-xs text-neutral-500 mt-1">
          Estas observações são privadas e não serão visíveis para o paciente
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Importante:</strong> Após salvar, você pode finalizar a evolução para torná-la imutável. 
          Uma vez finalizada, não será mais possível editar ou excluir.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} className="flex-1">
          {evolucao ? 'Atualizar' : 'Registrar'} Evolução
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
