'use client'

import { useEffect, useState } from 'react'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { Plus, Search, Users, AlertTriangle, UserCheck, UserX as UserXIcon } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import PacienteCard from '@/components/pacientes/PacienteCard'
import PacienteForm from '@/components/pacientes/PacienteForm'
import Toast from '@/components/common/Toast'
import { getUserRole } from '@/utils/auth'
import { canPerformAction } from '@/utils/roles'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPaciente, setEditingPaciente] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const userRole = getUserRole()
  const canCreate = canPerformAction(userRole, 'pacientes', 'create')
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [deactivateConfirm, setDeactivateConfirm] = useState({ open: false, id: null })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    loadPacientes()
  }, [showInactive])

  const loadPacientes = async () => {
    try {
      setLoading(true)
      let data
      if (isProfissional) {
        data = await profissionalService.getMyPacientes({ 
          ativo: showInactive ? undefined : true 
        })
      } else {
        data = await pacienteService.getAll({ 
          ativo: showInactive ? undefined : true 
        })
      }
      setPacientes(data)
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPaciente(null)
    setModalOpen(true)
  }

  const handleEdit = (paciente) => {
    setEditingPaciente(paciente)
    setModalOpen(true)
  }

  const handleDeactivate = (id) => {
    setDeactivateConfirm({ open: true, id })
  }

  const confirmDeactivate = async () => {
    try {
      await pacienteService.deactivate(deactivateConfirm.id)
      setDeactivateConfirm({ open: false, id: null })
      await loadPacientes()
      showToast('Paciente desativado com sucesso', 'success')
    } catch (error) {
      showToast('Erro ao desativar paciente', 'error')
    }
  }

  const handleReactivate = async (id) => {
    try {
      await pacienteService.reactivate(id)
      await loadPacientes()
    } catch (error) {
      showToast('Erro ao reativar paciente', 'error')
    }
  }

  const handleSave = async () => {
    setModalOpen(false)
    await loadPacientes()
  }

  const filteredPacientes = searchTerm
    ? pacientes.filter(p =>
        p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cpf?.includes(searchTerm) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.telefone_principal?.includes(searchTerm)
      )
    : pacientes

  const totalAtivos = pacientes.filter(p => p.ativo).length
  const totalInativos = pacientes.filter(p => !p.ativo).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">Gerencie o cadastro de pacientes da clínica</p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} icon={<Plus className="w-4 h-4" />}>
            Novo Paciente
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: pacientes.length, icon: Users, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Ativos', value: totalAtivos, icon: UserCheck, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Inativos', value: totalInativos, icon: UserXIcon, bg: 'bg-neutral-50', color: 'text-neutral-500' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF, email ou telefone..."
            className="input-field pl-10"
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer bg-white border border-neutral-200 rounded-xl px-4 py-2.5 hover:bg-neutral-50 transition-colors shadow-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
          />
          <span className="text-xs font-semibold text-neutral-600 whitespace-nowrap">Mostrar inativos</span>
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filteredPacientes.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description={searchTerm ? 'Tente buscar com outros termos' : 'Cadastre o primeiro paciente da clínica'}
          icon={<Users className="w-10 h-10" />}
          action={!searchTerm && canCreate ? handleCreate : undefined}
          actionLabel={!searchTerm && canCreate ? 'Cadastrar Paciente' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPacientes.map((paciente) => (
            <PacienteCard
              key={paciente.id}
              paciente={paciente}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPaciente ? 'Editar Paciente' : 'Novo Paciente'}
        size="xl"
      >
        <PacienteForm
          paciente={editingPaciente}
          onSuccess={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Confirm Deactivate Modal */}
      <Modal
        isOpen={deactivateConfirm.open}
        onClose={() => setDeactivateConfirm({ open: false, id: null })}
        title="Desativar Paciente"
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Tem certeza que deseja desativar este paciente?</p>
            <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">O paciente ficará inativo e não aparecerá nas listagens padrão.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDeactivateConfirm({ open: false, id: null })}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmDeactivate}
            >
              Desativar
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
