'use client'

import { useEffect, useState } from 'react'
import { agendamentoService } from '@/services/agendamentoService'
import { Plus, Calendar as CalendarIcon, List, Search, FileDown } from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import AgendamentoForm from '@/components/agenda/AgendamentoForm'
import AgendamentoCard from '@/components/agenda/AgendamentoCard'
import CalendarView from '@/components/agenda/CalendarView'
import Toast from '@/components/common/Toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getTodayBrazil } from '@/lib/dateUtils'
import { useAuth } from '@/context/AuthContext'
import { getUserRole } from '@/utils/auth'
import { api } from '@/lib/api'

export default function AgendaPage() {
  const { user } = useAuth()
  const userRole = getUserRole()
  const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)
  
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgendamento, setEditingAgendamento] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayBrazil())
  const [activeTab, setActiveTab] = useState('agendadas') // 'agendadas', 'concluidas', 'canceladas', 'todas'
  const [exportingPdf, setExportingPdf] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    loadAgendamentos()
  }, [selectedDate, activeTab, viewMode])

  const loadAgendamentos = async () => {
    try {
      setLoading(true)
      setError(null)

      // Construir filtros baseados no modo de visualização
      let filters = {}
      
      if (viewMode === 'calendar') {
        // No modo calendário, buscar todo o mês
        const date = new Date(selectedDate)
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        
        filters.data_inicio = format(startOfMonth, 'yyyy-MM-dd')
        filters.data_fim = format(endOfMonth, 'yyyy-MM-dd')
      } else if (activeTab === 'agendadas') {
        // No modo lista, filtrar pela data selecionada apenas se for aba "agendadas"
        filters.data_agendamento = selectedDate
      }
      
      // Se for profissional, adicionar filtro de profissional_id
      if (isProfissional && user?.id) {
        filters.profissional_id = user.id
      }
      
      const result = await agendamentoService.getAll(filters)
      
      const data = result.data || result || []
      
      // Filtrar por profissional se não for admin
      let filteredData = data
      if (isProfissional && user?.id) {
        filteredData = data.filter(a => a.profissional_id === user.id)
      }
      
      setAgendamentos(filteredData)
    } catch (error) {
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
    if (isProfissional) return
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
      showToast('Erro ao cancelar agendamento', 'error')
    }
  }

  const handleSave = async () => {
    setModalOpen(false)
    await loadAgendamentos()
  }

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true)
      
      // Construir parâmetros de filtro
      const params = new URLSearchParams()
      if (activeTab === 'agendadas') {
        params.append('data_agendamento', selectedDate)
      }
      if (isProfissional && user?.id) {
        params.append('profissional_id', user.id)
      }
      
      // Fazer requisição para exportar PDF
      const response = await api.download(`/agendamentos/export-pdf?${params.toString()}`)
      
      // Criar link para download
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `agenda_${selectedDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      showToast('Erro ao exportar agenda em PDF', 'error')
    } finally {
      setExportingPdf(false)
    }
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
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Agenda</h1>
          <p className="text-sm text-neutral-500 mt-0.5 hidden sm:block">Gerencie os agendamentos da clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportPdf}
            variant="outline"
            size="sm"
            icon={<FileDown className="w-4 h-4" />}
            disabled={exportingPdf}
            className="hidden sm:inline-flex"
          >
            {exportingPdf ? 'Gerando...' : 'PDF'}
          </Button>
          {!isProfissional && (
            <Button onClick={handleCreate} size="sm" icon={<Plus className="w-4 h-4" />}>
              <span className="hidden sm:inline">Novo Agendamento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Date nav + picker */}
        <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 flex-shrink-0">
          <button
            onClick={() => {
              const d = new Date(selectedDate)
              d.setDate(d.getDate() - 1)
              setSelectedDate(d.toISOString().split('T')[0])
            }}
            className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400"
            aria-label="Dia anterior"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-neutral-800 outline-none bg-transparent cursor-pointer w-[130px] text-center"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate)
              d.setDate(d.getDate() + 1)
              setSelectedDate(d.toISOString().split('T')[0])
            }}
            className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400"
            aria-label="Próximo dia"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar paciente ou profissional..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
          />
        </div>

        {/* View toggle */}
        <div className="flex bg-neutral-100 rounded-lg p-1 flex-shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            aria-label="Lista"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            aria-label="Calendário"
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div className="bg-white rounded-xl border border-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-none border-b border-neutral-100">
          {[
            { key: 'agendadas', label: 'Agendadas', short: 'Agend.', count: countAgendadas, activeClass: 'text-primary-600 border-primary-500 bg-primary-50/50', badgeClass: 'bg-primary-100 text-primary-700' },
            { key: 'concluidas', label: 'Concluídas', short: 'Concl.', count: countConcluidas, activeClass: 'text-green-600 border-green-500 bg-green-50/50', badgeClass: 'bg-green-100 text-green-700' },
            { key: 'canceladas', label: 'Canceladas', short: 'Canc.', count: countCanceladas, activeClass: 'text-red-600 border-red-500 bg-red-50/50', badgeClass: 'bg-red-100 text-red-700' },
            { key: 'todas', label: 'Todas', short: 'Todas', count: agendamentos.length, activeClass: 'text-neutral-900 border-neutral-800 bg-neutral-50', badgeClass: 'bg-neutral-200 text-neutral-700' },
          ].map(({ key, label, short, count, activeClass, badgeClass }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === key ? `${activeClass} border-b-2` : 'text-neutral-500 border-transparent hover:text-neutral-700 hover:bg-neutral-50'}`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
              {count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeTab === key ? badgeClass : 'bg-neutral-100 text-neutral-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={loadAgendamentos} className="text-xs underline font-medium flex-shrink-0">Tentar novamente</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : viewMode === 'calendar' ? (
        <CalendarView
          agendamentos={filteredAgendamentos}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onAgendamentoClick={handleEdit}
        />
      ) : filteredAgendamentos.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado"
          description={`Não há agendamentos para ${format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}`}
          icon={<CalendarIcon className="w-10 h-10" />}
          action={!isProfissional ? handleCreate : undefined}
          actionLabel={!isProfissional ? 'Criar Agendamento' : undefined}
        />
      ) : (
        <div className="space-y-2">
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

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
