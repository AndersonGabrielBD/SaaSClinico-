'use client'

import { useEffect, useState } from 'react'
import { prontuarioService } from '@/services/prontuarioService'
import { modeloEvolucaoService } from '@/services/modeloEvolucaoService'
import Button from '@/components/common/Button'
import { HUMOR_OPTIONS, COMPORTAMENTO_OPTIONS } from '@/constants/evolucaoTemplates'

function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(s) {
  if (!s || !String(s).trim()) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function mapRowToForm(row) {
  if (!row) {
    return {
      titulo_resumo: '',
      conteudo: '',
      observacoes: '',
      observacoes_confidenciais: '',
      humor: '',
      comportamento: '',
      data_sessao_local: '',
    }
  }
  return {
    titulo_resumo: row.titulo_resumo || '',
    conteudo: row.conteudo || '',
    observacoes: row.observacoes || '',
    observacoes_confidenciais: row.observacoes_confidenciais || '',
    humor: row.humor || '',
    comportamento: row.comportamento || '',
    data_sessao_local: toDatetimeLocalValue(row.data_sessao),
  }
}

export default function EvolucaoForm({
  prontuarioId,
  evolucao,
  defaultValues = {},
  /** Incrementar para reaplicar defaultValues no modo criação */
  seed = 0,
  showTemplates = false,
  onSuccess,
  onCancel,
}) {
  const [loading, setLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [error, setError] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [modelos, setModelos] = useState([])
  const [modelosLoading, setModelosLoading] = useState(false)
  const [formData, setFormData] = useState(() => {
    if (evolucao) return mapRowToForm(evolucao)
    const base = mapRowToForm(null)
    const merged = { ...base, ...defaultValues }
    merged.data_sessao_local =
      defaultValues.data_sessao_local !== undefined
        ? defaultValues.data_sessao_local
        : toDatetimeLocalValue(defaultValues.data_sessao) || ''
    return merged
  })

  const defaultsKey = JSON.stringify(defaultValues)

  useEffect(() => {
    if (evolucao) {
      setFormData(mapRowToForm(evolucao))
      return
    }
    const base = mapRowToForm(null)
    const merged = { ...base, ...defaultValues }
    merged.data_sessao_local =
      defaultValues.data_sessao_local !== undefined
        ? defaultValues.data_sessao_local
        : toDatetimeLocalValue(defaultValues.data_sessao) || ''
    setFormData(merged)
  }, [evolucao?.id, seed, defaultsKey])

  useEffect(() => {
    if (!showTemplates || evolucao) return
    let cancelled = false
    ;(async () => {
      try {
        setModelosLoading(true)
        const rows = await modeloEvolucaoService.list()
        if (!cancelled) setModelos(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setModelos([])
      } finally {
        if (!cancelled) setModelosLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showTemplates, evolucao?.id])

  const applyTemplate = (id) => {
    setTemplateId(id)
    if (!id) return
    const t = modelos.find((x) => x.id === id)
    if (!t) return
    const v = t.valores_padrao || {}
    setFormData((prev) => ({
      ...prev,
      titulo_resumo: v.titulo_resumo ?? '',
      conteudo: v.conteudo ?? '',
      observacoes: v.observacoes ?? '',
      humor: v.humor ?? '',
      comportamento: v.comportamento ?? '',
      observacoes_confidenciais: prev.observacoes_confidenciais,
      data_sessao_local: prev.data_sessao_local,
    }))
  }

  const handleCopyPrevious = async () => {
    setError('')
    try {
      setCopyLoading(true)
      const ultima = await prontuarioService.getUltimaEvolucao(prontuarioId)
      if (!ultima) {
        setError('Não há evolução anterior sua neste prontuário.')
        return
      }
      setFormData(mapRowToForm(ultima))
      setTemplateId('')
    } catch (err) {
      setError(err.message || 'Erro ao buscar evolução anterior')
    } finally {
      setCopyLoading(false)
    }
  }

  const buildPayload = () => {
    const data_sessao = fromDatetimeLocalValue(formData.data_sessao_local)
    return {
      conteudo: formData.conteudo.trim(),
      titulo_resumo: formData.titulo_resumo.trim() || undefined,
      observacoes: formData.observacoes.trim() || undefined,
      observacoes_confidenciais: formData.observacoes_confidenciais.trim() || undefined,
      humor: formData.humor || undefined,
      comportamento: formData.comportamento || undefined,
      ...(data_sessao ? { data_sessao } : {}),
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.conteudo?.trim()) {
      setError('Descrição da evolução (conteúdo) é obrigatória')
      return
    }

    try {
      setLoading(true)
      const payload = buildPayload()

      if (evolucao) {
        await prontuarioService.updateEvolucao(prontuarioId, evolucao.id, payload)
      } else {
        await prontuarioService.createEvolucao(prontuarioId, payload)
      }

      onSuccess()
    } catch (err) {
      setError(err.message || 'Erro ao salvar evolução')
    } finally {
      setLoading(false)
    }
  }

  const isEdit = Boolean(evolucao)

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
          {error}
        </div>
      )}

      {!isEdit && showTemplates && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Usar template</label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              disabled={modelosLoading}
              className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white disabled:opacity-60"
            >
              <option value="">
                {modelosLoading ? 'Carregando modelos…' : 'Selecione um modelo…'}
              </option>
              {modelos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={copyLoading}
            onClick={handleCopyPrevious}
            className="whitespace-nowrap"
          >
            Copiar evolução anterior
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Humor</label>
          <select
            value={formData.humor}
            onChange={(e) => setFormData({ ...formData, humor: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
          >
            {HUMOR_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Comportamento</label>
          <select
            value={formData.comportamento}
            onChange={(e) => setFormData({ ...formData, comportamento: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
          >
            {COMPORTAMENTO_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Data da sessão</label>
        <input
          type="datetime-local"
          value={formData.data_sessao_local}
          onChange={(e) => setFormData({ ...formData, data_sessao_local: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Título / resumo</label>
        <input
          type="text"
          value={formData.titulo_resumo}
          onChange={(e) => setFormData({ ...formData, titulo_resumo: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Ex.: Retorno, avaliação, sessão X"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Descrição da evolução *</label>
        <textarea
          value={formData.conteudo}
          onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono leading-relaxed min-h-[7rem] max-h-48"
          placeholder="Evolução clínica, procedimentos, objetivos…"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Observações</label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          rows={2}
          className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Anotações gerais (não confidenciais)"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Observações confidenciais (uso interno)
        </label>
        <textarea
          value={formData.observacoes_confidenciais}
          onChange={(e) => setFormData({ ...formData, observacoes_confidenciais: e.target.value })}
          rows={2}
          className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Não compartilhar com o paciente"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
        <p className="text-xs text-blue-800 leading-snug">
          <strong>Importante:</strong> após salvar, você pode finalizar a evolução para torná-la imutável.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={loading} size="sm" className="flex-1">
          {evolucao ? 'Atualizar' : 'Registrar'} evolução
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
