'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { modeloEvolucaoService } from '@/services/modeloEvolucaoService'
import Button from '@/components/common/Button'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { ChevronLeft, Trash2, Pencil, Plus } from 'lucide-react'

const EMPTY_VALORES = {
  titulo_resumo: '',
  conteudo: '',
  observacoes: '',
  humor: '',
  comportamento: '',
}

function mergeValores(v) {
  return { ...EMPTY_VALORES, ...(v || {}) }
}

export default function ModelosEvolucaoPage() {
  const role = getUserRole()
  const allowed = canAccessModule(role, 'modelos_evolucao')

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    nome: '',
    ordem: 0,
    valores_padrao: { ...EMPTY_VALORES },
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setLoading(true)
      const rows = await modeloEvolucaoService.list()
      setList(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setError(e.message || 'Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  const resetForm = () => {
    setEditingId(null)
    setForm({ nome: '', ordem: 0, valores_padrao: { ...EMPTY_VALORES } })
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setForm({
      nome: row.nome || '',
      ordem: row.ordem ?? 0,
      valores_padrao: mergeValores(row.valores_padrao),
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nome.trim()) {
      setError('Informe o nome do modelo')
      return
    }
    try {
      setSaving(true)
      const payload = {
        nome: form.nome.trim(),
        ordem: Number(form.ordem) || 0,
        valores_padrao: form.valores_padrao,
      }
      if (editingId) {
        await modeloEvolucaoService.update(editingId, payload)
      } else {
        await modeloEvolucaoService.create(payload)
      }
      resetForm()
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este modelo?')) return
    setError('')
    try {
      await modeloEvolucaoService.remove(id)
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao excluir')
    }
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-neutral-600 text-sm">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/prontuarios"
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Prontuários
          </Link>
          <h1 className="page-title">Modelos de evolução</h1>
          <p className="page-subtitle">
            Crie textos padrão para preencher evoluções mais rápido. Cada modelo é seu — outros profissionais não veem.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
            {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Editar modelo' : 'Novo modelo'}
          </h2>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Nome do modelo *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ex.: Sessão de fonoaudiologia"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Ordem na lista</label>
            <input
              type="number"
              value={form.ordem}
              onChange={(e) => setForm({ ...form, ordem: e.target.value })}
              className="w-28 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Título / resumo (padrão)</label>
            <input
              type="text"
              value={form.valores_padrao.titulo_resumo}
              onChange={(e) =>
                setForm({
                  ...form,
                  valores_padrao: { ...form.valores_padrao, titulo_resumo: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Conteúdo (padrão)</label>
            <textarea
              value={form.valores_padrao.conteudo}
              onChange={(e) =>
                setForm({
                  ...form,
                  valores_padrao: { ...form.valores_padrao, conteudo: e.target.value },
                })
              }
              rows={5}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Observações (padrão)</label>
            <textarea
              value={form.valores_padrao.observacoes}
              onChange={(e) =>
                setForm({
                  ...form,
                  valores_padrao: { ...form.valores_padrao, observacoes: e.target.value },
                })
              }
              rows={2}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Humor (valor padrão)</label>
              <input
                type="text"
                value={form.valores_padrao.humor}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valores_padrao: { ...form.valores_padrao, humor: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Ex.: estável (opcional)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Comportamento (padrão)</label>
              <input
                type="text"
                value={form.valores_padrao.comportamento}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valores_padrao: { ...form.valores_padrao, comportamento: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Ex.: colaborativo"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {editingId ? 'Salvar alterações' : 'Criar modelo'}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5">
          <h2 className="text-sm font-bold text-neutral-800 mb-3">Seus modelos</h2>
          {loading ? (
            <p className="text-sm text-neutral-500">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum modelo ainda. Crie o primeiro ao lado.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-2 p-3 rounded-xl border border-neutral-100 bg-neutral-50/80"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{row.nome}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Ordem {row.ordem ?? 0}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="p-2 rounded-lg text-primary-600 hover:bg-primary-50"
                      aria-label="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
