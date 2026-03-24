'use client'

import { useEffect, useState } from 'react'
import { prontuarioService } from '@/services/prontuarioService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { Plus, Search, FileText, Filter, AlertTriangle } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import ProntuarioCard from '@/components/prontuarios/ProntuarioCard'
import ProntuarioForm from '@/components/prontuarios/ProntuarioForm'
import Toast from '@/components/common/Toast'
import { getUserRole } from '@/utils/auth'
import { parseDateSafe } from '@/lib/dateUtils'

export default function ProntuariosPage() {
  const [prontuarios, setProntuarios] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProntuario, setEditingProntuario] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPaciente, setSelectedPaciente] = useState('')
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    loadData()
  }, [selectedPaciente])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Carregar prontuários
      const filters = {}
      if (selectedPaciente) {
        filters.paciente_id = selectedPaciente
      }
      
      let prontuariosData, pacientesData
      
      if (isProfissional) {
        // Profissionais veem apenas prontuários dos seus pacientes
        prontuariosData = await profissionalService.getMyProntuarios(filters)
        pacientesData = await profissionalService.getMyPacientes({ ativo: true })
      } else {
        // Admin e recepção veem todos
        prontuariosData = await prontuarioService.getAll(filters)
        pacientesData = await pacienteService.getAll({ ativo: true })
      }
      
      setProntuarios(prontuariosData)
      setPacientes(pacientesData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingProntuario(null)
    setModalOpen(true)
  }

  const handleEdit = (prontuario) => {
    setEditingProntuario(prontuario)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    setDeleteConfirm({ open: true, id })
  }

  const confirmDelete = async () => {
    try {
      await prontuarioService.delete(deleteConfirm.id)
      setDeleteConfirm({ open: false, id: null })
      await loadData()
      showToast('Prontuário excluído com sucesso', 'success')
    } catch (error) {
      console.error('Erro ao excluir prontuário:', error)
      showToast('Erro ao excluir prontuário', 'error')
    }
  }

  const handleSave = async () => {
    setModalOpen(false)
    await loadData()
  }

  const filteredProntuarios = searchTerm
    ? prontuarios.filter(p =>
        p.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tipo_prontuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.paciente?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : prontuarios

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Prontuários</h1>
          <p className="page-subtitle">
            Gerencie os prontuários e evoluções dos pacientes
          </p>
        </div>
        <Button onClick={handleCreate} icon={<Plus className="w-5 h-5" />}>
          Novo Prontuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-neutral-900">{prontuarios.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Este Mês</p>
            <p className="text-xl font-bold text-blue-600">
              {prontuarios.filter(p => {
                const date = parseDateSafe(p.data_criacao || p.created_at)
                if (!date) return false
                const now = new Date()
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
              }).length}
            </p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Pacientes Atendidos</p>
            <p className="text-xl font-bold text-green-600">
              {new Set(prontuarios.map(p => p.paciente_id)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título, tipo ou paciente..."
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Filtro de Paciente */}
          <div className="lg:w-64">
            <select
              value={selectedPaciente}
              onChange={(e) => setSelectedPaciente(e.target.value)}
              className="select-field"
            >
              <option value="">Todos os pacientes</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_completo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filteredProntuarios.length === 0 ? (
        <EmptyState
          title="Nenhum prontuário encontrado"
          description={searchTerm || selectedPaciente ? 'Tente ajustar os filtros' : 'Crie o primeiro prontuário'}
          icon={<FileText className="w-16 h-16" />}
          action={!searchTerm && !selectedPaciente ? {
            label: 'Criar Prontuário',
            onClick: handleCreate
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 [&>*]:!rounded-2xl">
          {filteredProntuarios.map((prontuario) => (
            <ProntuarioCard
              key={prontuario.id}
              prontuario={prontuario}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProntuario ? 'Editar Prontuário' : 'Novo Prontuário'}
        size="xl"
      >
        <ProntuarioForm
          prontuario={editingProntuario}
          onSuccess={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        title="Excluir Prontuário"
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Tem certeza que deseja excluir este prontuário?</p>
            <p className="text-sm text-neutral-500 mt-1">Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDeleteConfirm({ open: false, id: null })}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
