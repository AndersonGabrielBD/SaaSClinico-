'use client'

import { useState, useEffect, useCallback } from 'react'
import { DoorOpen, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import EmptyState from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import { getUserRole } from '@/utils/auth'
import { canPerformAction } from '@/utils/roles'
import * as api from '@/lib/api'

export default function SalasPage() {
  const userRole = getUserRole()
  const canEdit = canPerformAction(userRole, 'salas', 'edit')
  const canCreate = canPerformAction(userRole, 'salas', 'create')
  const canDelete = canPerformAction(userRole, 'salas', 'delete')

  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSala, setEditingSala] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, sala: null })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    capacidade: 1,
    ativo: true,
  })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  const loadSalas = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getSalas()
      setSalas(data?.data || data || [])
    } catch (err) {
      showToast('Erro ao carregar salas', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSalas()
  }, [loadSalas])

  const openCreate = () => {
    setEditingSala(null)
    setFormData({ nome: '', descricao: '', capacidade: 1, ativo: true })
    setModalOpen(true)
  }

  const openEdit = (sala) => {
    setEditingSala(sala)
    setFormData({
      nome: sala.nome || '',
      descricao: sala.descricao || '',
      capacidade: sala.capacidade ?? 1,
      ativo: sala.ativo ?? true,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.nome.trim()) return

    try {
      setSaving(true)
      if (editingSala) {
        await api.updateSala(editingSala.id, formData)
        showToast('Sala atualizada com sucesso!')
      } else {
        await api.createSala(formData)
        showToast('Sala criada com sucesso!')
      }
      setModalOpen(false)
      loadSalas()
    } catch (err) {
      showToast(err.message || 'Erro ao salvar sala', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAtivo = async (sala) => {
    try {
      await api.updateSala(sala.id, { ativo: !sala.ativo })
      showToast(`Sala ${!sala.ativo ? 'ativada' : 'desativada'} com sucesso!`)
      loadSalas()
    } catch (err) {
      showToast('Erro ao alterar status da sala', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.sala) return
    try {
      await api.deleteSala(deleteConfirm.sala.id)
      showToast('Sala removida com sucesso!')
      setDeleteConfirm({ open: false, sala: null })
      loadSalas()
    } catch (err) {
      showToast(err.message || 'Erro ao remover sala', 'error')
    }
  }

  const ativas = salas.filter(s => s.ativo !== false)
  const inativas = salas.filter(s => s.ativo === false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-900">Salas</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Gerencie as salas disponíveis para agendamento
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
            <span className="hidden sm:inline">Nova Sala</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        )}
      </div>

      {/* Stats strip */}
      {!loading && salas.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span>{ativas.length} ativa{ativas.length !== 1 ? 's' : ''}</span>
          </span>
          {inativas.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-300 inline-block" />
              <span>{inativas.length} inativa{inativas.length !== 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : salas.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="w-8 h-8" />}
          title="Nenhuma sala cadastrada"
          description="Crie salas para associá-las aos agendamentos da clínica."
          action={canCreate ? openCreate : undefined}
          actionLabel="Criar primeira sala"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {salas.map((sala) => (
            <div
              key={sala.id}
              className={`bg-white rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden transition-opacity ${
                sala.ativo === false ? 'opacity-60' : ''
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    sala.ativo !== false ? 'bg-primary-50 text-primary-500' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{sala.nome}</p>
                    {sala.descricao && (
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{sala.descricao}</p>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                  sala.ativo !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {sala.ativo !== false ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              {/* Capacidade */}
              {sala.capacidade != null && (
                <div className="flex items-center gap-1.5 px-4 pb-3 text-xs text-neutral-500">
                  <Users className="w-3.5 h-3.5" />
                  Capacidade: {sala.capacidade}
                </div>
              )}

              {/* Actions */}
              {(canEdit || canDelete) && (
                <div className="flex items-center gap-1 px-3 py-2 border-t border-neutral-50 bg-neutral-50/50">
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(sala)}
                        icon={<Edit className="w-3.5 h-3.5" />}
                        aria-label="Editar sala"
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAtivo(sala)}
                        icon={sala.ativo !== false
                          ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                          : <ToggleLeft className="w-3.5 h-3.5 text-neutral-400" />
                        }
                        aria-label={sala.ativo !== false ? 'Desativar sala' : 'Ativar sala'}
                      >
                        {sala.ativo !== false ? 'Desativar' : 'Ativar'}
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirm({ open: true, sala })}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto"
                      aria-label="Remover sala"
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
        title={editingSala ? 'Editar Sala' : 'Nova Sala'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Nome da sala *
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Sala 1, Consultório A..."
              className="w-full h-9 px-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Descrição
            </label>
            <input
              type="text"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição opcional..."
              className="w-full h-9 px-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Capacidade
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.capacidade}
              onChange={(e) => setFormData({ ...formData, capacidade: parseInt(e.target.value) || 1 })}
              className="w-full h-9 px-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
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
            <span className="text-sm text-neutral-700">Sala ativa</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {editingSala ? 'Salvar alterações' : 'Criar sala'}
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
        onClose={() => setDeleteConfirm({ open: false, sala: null })}
        title="Remover sala"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Tem certeza que deseja remover a sala{' '}
            <strong className="text-neutral-900">{deleteConfirm.sala?.nome}</strong>?
            Esta ação não poderá ser desfeita.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Remover
            </Button>
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, sala: null })}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  )
}
