'use client'

import { useEffect, useState } from 'react'
import { prontuarioService } from '@/services/prontuarioService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { Plus, Search, FileText, Filter } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import ProntuarioCard from '@/components/prontuarios/ProntuarioCard'
import ProntuarioForm from '@/components/prontuarios/ProntuarioForm'
import { getUserRole } from '@/utils/auth'

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

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir este prontuário?')) return

    try {
      await prontuarioService.delete(id)
      await loadData()
    } catch (error) {
      console.error('Erro ao excluir prontuário:', error)
      alert('Erro ao excluir prontuário')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Prontuários</h1>
          <p className="text-neutral-600 mt-1">
            Gerencie os prontuários e evoluções dos pacientes
          </p>
        </div>
        <Button onClick={handleCreate} icon={<Plus className="w-5 h-5" />}>
          Novo Prontuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total</p>
              <p className="text-2xl font-bold text-neutral-900">{prontuarios.length}</p>
            </div>
            <FileText className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Este Mês</p>
              <p className="text-2xl font-bold text-blue-600">
                {prontuarios.filter(p => {
                  const date = new Date(p.data_criacao || p.created_at)
                  const now = new Date()
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
                }).length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Pacientes Atendidos</p>
              <p className="text-2xl font-bold text-green-600">
                {new Set(prontuarios.map(p => p.paciente_id)).size}
              </p>
            </div>
            <FileText className="w-8 h-8 text-green-500" />
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
                placeholder="Buscar por título, tipo ou paciente..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Filtro de Paciente */}
          <div className="lg:w-64">
            <select
              value={selectedPaciente}
              onChange={(e) => setSelectedPaciente(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
        <div className="grid grid-cols-1 gap-4">
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
    </div>
  )
}
