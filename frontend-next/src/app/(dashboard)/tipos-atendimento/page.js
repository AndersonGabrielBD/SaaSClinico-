'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Plus, Edit, Trash2, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import EmptyState from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import { canPerformAction, canAccessModule } from '@/utils/roles'
import { getUserRole } from '@/utils/auth'
import * as api from '@/lib/api'

export default function TiposAtendimentoPage() {
  const router = useRouter()
  const userRole = getUserRole()
  const canCreate = canPerformAction(userRole, 'tipos_atendimento', 'create')
  const canEdit = canPerformAction(userRole, 'tipos_atendimento', 'edit')
  const canDelete = canPerformAction(userRole, 'tipos_atendimento', 'delete')

  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTipo, setEditingTipo] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, tipo: null })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [formData, setFormData] = useState({ nome: '', ativo: true, ordem: 0 })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  const loadTipos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getTiposAtendimento()
      setTipos(data?.data || data || [])
    } catch {
      showToast('Erro ao carregar tipos de atendimento', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userRole && !canAccessModule(userRole, 'tipos_atendimento')) {
      router.replace('/agenda')
      return
    }
    loadTipos()
  }, [loadTipos, userRole, router])

  const openCreate = () => {
    setEditingTipo(null)
    setFormData({ nome: '', ativo: true, ordem: tipos.length })
    setModalOpen(true)
  }

  const openEdit = (tipo) => {
    setEditingTipo(tipo)
    setFormData({ nome: tipo.nome || '', ativo: tipo.ativo ?? true, ordem: tipo.ordem ?? 0 })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.nome.trim()) return

    try {
      setSaving(true)
      if (editingTipo?.id) {
        await api.updateTipoAtendimento(editingTipo.id, formData)
        showToast('Tipo atualizado com sucesso!')
      } else {
        await api.createTipoAtendimento(formData)
        showToast('Tipo criado com sucesso!')
      }
      setModalOpen(false)
      loadTipos()
    } catch (err) {
      showToast(err.message || 'Erro ao salvar tipo', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAtivo = async (tipo) => {
    if (!tipo.id) return
    try {
      await api.updateTipoAtendimento(tipo.id, { ativo: !tipo.ativo })
      showToast(`Tipo ${!tipo.ativo ? 'ativado' : 'desativado'} com sucesso!`)
      loadTipos()
    } catch {
      showToast('Erro ao alterar status', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.tipo?.id) return
    try {
      await api.deleteTipoAtendimento(deleteConfirm.tipo.id)
      showToast('Tipo removido com sucesso!')
      setDeleteConfirm({ open: false, tipo: null })
      loadTipos()
    } catch (err) {
      showToast(err.message || 'Erro ao remover tipo', 'error')
    }
  }

  const isPadrao = (tipo) => !tipo.id

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-900">Tipos de Atendimento</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Personalize os tipos disponíveis nos agendamentos
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
            <span className="hidden sm:inline">Novo Tipo</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        )}
      </div>

      {/* Info banner when showing defaults */}
      {!loading && tipos.length > 0 && isPadrao(tipos[0]) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Exibindo tipos <strong>padrão do sistema</strong>. Crie tipos personalizados para substituí-los.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : tipos.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-8 h-8" />}
          title="Nenhum tipo cadastrado"
          description="Crie tipos de atendimento para personalizar os agendamentos da clínica."
          action={canCreate ? openCreate : undefined}
          actionLabel="Criar primeiro tipo"
        />
      ) : (
        <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] divide-y divide-neutral-50">
          {tipos.map((tipo, index) => (
            <div
              key={tipo.id || tipo.nome}
              className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
                tipo.ativo === false ? 'opacity-50' : ''
              }`}
            >
              <GripVertical className="w-4 h-4 text-neutral-300 flex-shrink-0" />

              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium text-neutral-900 truncate">{tipo.nome}</span>
                {isPadrao(tipo) && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 flex-shrink-0">
                    padrão
                  </span>
                )}
              </div>

              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${
                tipo.ativo !== false
                  ? 'bg-green-100 text-green-700'
                  : 'bg-neutral-100 text-neutral-500'
              }`}>
                {tipo.ativo !== false ? 'Ativo' : 'Inativo'}
              </span>

              {/* Actions — only for DB records */}
              {!isPadrao(tipo) && (canEdit || canDelete) && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(tipo)}
                        icon={<Edit className="w-3.5 h-3.5" />}
                        aria-label="Editar tipo"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAtivo(tipo)}
                        icon={tipo.ativo !== false
                          ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                          : <ToggleLeft className="w-3.5 h-3.5 text-neutral-400" />
                        }
                        aria-label={tipo.ativo !== false ? 'Desativar' : 'Ativar'}
                      />
                    </>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirm({ open: true, tipo })}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Remover tipo"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTipo ? 'Editar Tipo' : 'Novo Tipo de Atendimento'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Nome *
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Consulta, Avaliação, Terapia..."
              className="w-full h-9 px-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formData.ativo}
              onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                formData.ativo ? 'bg-primary-500' : 'bg-neutral-300'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                formData.ativo ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <span className="text-sm text-neutral-700">Tipo ativo</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {editingTipo ? 'Salvar alterações' : 'Criar tipo'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm Modal */}
      <Modal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, tipo: null })}
        title="Remover tipo de atendimento"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Tem certeza que deseja remover{' '}
            <strong className="text-neutral-900">{deleteConfirm.tipo?.nome}</strong>?
            Agendamentos existentes com este tipo não serão afetados.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Remover
            </Button>
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, tipo: null })}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  )
}
