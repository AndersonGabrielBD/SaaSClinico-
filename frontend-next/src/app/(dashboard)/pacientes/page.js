'use client'

import { useEffect, useState } from 'react'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { Plus, Search, Users } from 'lucide-react'
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

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    loadPacientes()
  }, [showInactive])

  const loadPacientes = async () => {
    try {
      setLoading(true)
      
      // Profissionais veem apenas seus pacientes vinculados
      let data
      if (isProfissional) {
        data = await profissionalService.getMyPacientes({ 
          ativo: showInactive ? undefined : true 
        })
      } else {
        // Admin e recepção veem todos os pacientes
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

  const handleDeactivate = async (id) => {
    if (!confirm('Deseja realmente desativar este paciente?')) return

    try {
      await pacienteService.deactivate(id)
      await loadPacientes()
    } catch (error) {
      console.error('Erro ao desativar paciente:', error)
      showToast('Erro ao desativar paciente', 'error')
    }
  }

  const handleReactivate = async (id) => {
    try {
      await pacienteService.reactivate(id)
      await loadPacientes()
    } catch (error) {
      console.error('Erro ao reativar paciente:', error)
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Pacientes</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie o cadastro de pacientes</p>
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
          { label: 'Total', value: pacientes.length, color: 'text-neutral-900' },
          { label: 'Ativos', value: pacientes.filter(p => p.ativo).length, color: 'text-green-600' },
          { label: 'Inativos', value: pacientes.filter(p => !p.ativo).length, color: 'text-neutral-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-xs text-neutral-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF, email ou telefone..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer bg-white border border-neutral-200 rounded-lg px-3 py-2 hover:bg-neutral-50 transition-colors">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-3.5 h-3.5 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
          />
          <span className="text-xs font-medium text-neutral-600 whitespace-nowrap">Mostrar inativos</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
