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
      alert('Erro ao desativar paciente')
    }
  }

  const handleReactivate = async (id) => {
    try {
      await pacienteService.reactivate(id)
      await loadPacientes()
    } catch (error) {
      console.error('Erro ao reativar paciente:', error)
      alert('Erro ao reativar paciente')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pacientes</h1>
          <p className="text-neutral-600 mt-1">
            Gerencie o cadastro de pacientes
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} icon={<Plus className="w-5 h-5" />}>
            Novo Paciente
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total de Pacientes</p>
              <p className="text-2xl font-bold text-neutral-900">{pacientes.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Ativos</p>
              <p className="text-2xl font-bold text-green-600">
                {pacientes.filter(p => p.ativo).length}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Inativos</p>
              <p className="text-2xl font-bold text-neutral-400">
                {pacientes.filter(p => !p.ativo).length}
              </p>
            </div>
            <Users className="w-8 h-8 text-neutral-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF, email ou telefone..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Show Inactive Toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-neutral-700">Mostrar inativos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filteredPacientes.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description={searchTerm ? 'Tente buscar com outros termos' : 'Cadastre o primeiro paciente da clínica'}
          icon={<Users className="w-16 h-16" />}
          action={!searchTerm && canCreate ? {
            label: 'Cadastrar Paciente',
            onClick: handleCreate
          } : undefined}
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
    </div>
  )
}
