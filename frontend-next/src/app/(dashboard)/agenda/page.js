'use client'

import { useEffect, useState } from 'react'
import { agendamentoService } from '@/services/agendamentoService'
import { Plus, Calendar as CalendarIcon, List, Search } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import AgendamentoForm from '@/components/agenda/AgendamentoForm'
import AgendamentoCard from '@/components/agenda/AgendamentoCard'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgendamento, setEditingAgendamento] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('agendadas') // 'agendadas', 'concluidas', 'canceladas', 'todas'

  useEffect(() => {
    loadAgendamentos()
  }, [selectedDate, activeTab])

  const loadAgendamentos = async () => {
    try {
      setLoading(true)
      setError(null)

      
      // Se estiver em concluídas, canceladas ou todas, não filtrar por data
      const filters = activeTab === 'agendadas' ? { data_agendamento: selectedDate } : {}
      
      const result = await agendamentoService.getAll(filters)
      
      console.log('📅 [AGENDA PAGE] Resultado bruto:', result)
      const data = result.data || result || []
      console.log('📅 [AGENDA PAGE] Dados processados:', data)
      console.log('📅 [AGENDA PAGE] Quantidade:', data.length)
      
      // Log da estrutura do primeiro agendamento
      if (data.length > 0) {
        console.log('📅 [AGENDA PAGE] Estrutura do primeiro agendamento:', data[0])
        console.log('📅 [AGENDA PAGE] Tem paciente?', !!data[0].paciente)
        console.log('📅 [AGENDA PAGE] Tem profissional?', !!data[0].profissional)
        console.log('📅 [AGENDA PAGE] Chaves disponíveis:', Object.keys(data[0]))
      }
      
      console.log('✅ [AGENDA PAGE] Agendamentos carregados')
      console.log('📅 [AGENDA PAGE] ====================')
      
      setAgendamentos(data)
    } catch (error) {
      console.error('❌ [AGENDA PAGE] ====================')
      console.error('❌ [AGENDA PAGE] Erro ao carregar agendamentos:', error)
      console.error('❌ [AGENDA PAGE] Message:', error.message)
      console.error('❌ [AGENDA PAGE] Response:', error.response)
      console.error('❌ [AGENDA PAGE] ====================')
      
      // Identifica o tipo de erro
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setError('Backend não está respondendo. Verifique se o servidor está rodando em http://localhost:5000')
      } else if (error.response?.status === 401) {
        setError('Sessão expirada. Faça login novamente.')
      } else if (error.response?.status === 500) {
        setError('Erro no servidor. Verifique se as migrations do Supabase foram aplicadas.')
      } else {
        setError(error.message || 'Erro ao carregar agendamentos')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingAgendamento(null)
    setModalOpen(true)
  }

  const handleEdit = (agendamento) => {
    setEditingAgendamento(agendamento)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return

    try {
      await agendamentoService.cancel(id)
      await loadAgendamentos()
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error)
      alert('Erro ao cancelar agendamento')
    }
  }

  const handleSave = async () => {
    setModalOpen(false)
    await loadAgendamentos()
  }

  const filteredAgendamentos = agendamentos.filter(a => {
    // Filtro por aba/tab
    if (activeTab === 'agendadas') {
      if (!['agendada', 'confirmada', 'em_atendimento'].includes(a.status)) return false
    } else if (activeTab === 'concluidas') {
      if (a.status !== 'concluida') return false
    } else if (activeTab === 'canceladas') {
      if (a.status !== 'cancelada') return false
    }
    // activeTab === 'todas' mostra todos
    
    // Filtro de busca
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    
    // Buscar por campos disponíveis
    return (
      a.tipo_atendimento?.toLowerCase().includes(search) ||
      a.observacoes?.toLowerCase().includes(search) ||
      a.id?.toLowerCase().includes(search) ||
      // Se tiver os dados relacionados, buscar também
      a.paciente?.nome_completo?.toLowerCase().includes(search) ||
      a.profissional?.nome_completo?.toLowerCase().includes(search)
    )
  })
  
  // Contar por status
  const countAgendadas = agendamentos.filter(a => ['agendada', 'confirmada', 'em_atendimento'].includes(a.status)).length
  const countConcluidas = agendamentos.filter(a => a.status === 'concluida').length
  const countCanceladas = agendamentos.filter(a => a.status === 'cancelada').length
  
  console.log('📅 [FILTRO] Total agendamentos:', agendamentos.length)
  console.log('📅 [FILTRO] Após filtro:', filteredAgendamentos.length)
  console.log('📅 [FILTRO] SearchTerm:', searchTerm)
  console.log('📅 [FILTRO] ActiveTab:', activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Agenda</h1>
          <p className="text-neutral-600 mt-1">
            Gerencie os agendamentos da clínica
          </p>
        </div>
        <Button onClick={handleCreate} icon={<Plus className="w-5 h-5" />}>
          Novo Agendamento
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('agendadas')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'agendadas'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Agendadas
            {countAgendadas > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                {countAgendadas}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('concluidas')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'concluidas'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Concluídas
            {countConcluidas > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                {countConcluidas}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('canceladas')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'canceladas'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Canceladas
            {countCanceladas > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                {countCanceladas}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('todas')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'todas'
                ? 'text-neutral-900 border-b-2 border-neutral-900 bg-neutral-50'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Todas
            {agendamentos.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-neutral-200 text-neutral-700 rounded-full">
                {agendamentos.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Date Picker */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por paciente ou profissional..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* View Mode */}
          <div className="flex items-end">
            <div className="flex bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded ${viewMode === 'calendar' ? 'bg-white shadow-sm' : ''}`}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 text-red-600 mt-0.5">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Erro ao carregar agendamentos</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={loadAgendamentos}
                className="mt-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filteredAgendamentos.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado"
          description={`Não há agendamentos para ${format(new Date(selectedDate), "dd 'de' MMMM", { locale: ptBR })}`}
          icon={<CalendarIcon className="w-16 h-16" />}
          action={{
            label: 'Criar Agendamento',
            onClick: handleCreate
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAgendamentos.map((agendamento) => (
            <AgendamentoCard
              key={agendamento.id}
              agendamento={agendamento}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={loadAgendamentos}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
        size="lg"
      >
        <AgendamentoForm
          agendamento={editingAgendamento}
          onSuccess={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
