'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { prontuarioService } from '@/services/prontuarioService'
import { pacienteService } from '@/services/pacienteService'
import RelatoriosList from '@/components/relatorios/RelatoriosList'
import FrequenciaCard from '@/components/frequencia/FrequenciaCard'
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Calendar, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Pill,
  Clock,
  UserCircle,
  FileDown,
  ClipboardList,
  Lock,
  Plus
} from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import ProntuarioForm from '@/components/prontuarios/ProntuarioForm'
import EvolucaoForm from '@/components/prontuarios/EvolucaoForm'
import Toast from '@/components/common/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { api } from '@/lib/api'
import { parseDateSafe } from '@/lib/dateUtils'
import { getUserRole, getUser, isAdmin } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'

function mapUltimaToFormDefaults(row) {
  if (!row) return {}
  return {
    titulo_resumo: row.titulo_resumo || '',
    conteudo: row.conteudo || '',
    observacoes: row.observacoes || '',
    observacoes_confidenciais: row.observacoes_confidenciais || '',
    humor: row.humor || '',
    comportamento: row.comportamento || '',
    data_sessao: row.data_sessao || undefined,
  }
}

function canMutateEvolucao(ev, user) {
  if (!ev || ev.imutavel) return false
  if (!user?.id) return false
  if (isAdmin()) return true
  return ev.criado_por === user.id
}

export default function ProntuarioDetailPage() {
  const params = useParams()
  const router = useRouter()
  const prontuarioId = params.id
  
  const [prontuario, setProntuario] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [evolucoes, setEvolucoes] = useState([])
  const [evolucaoModalOpen, setEvolucaoModalOpen] = useState(false)
  const [editingEvolucao, setEditingEvolucao] = useState(null)
  const [novaEvolucaoDefaults, setNovaEvolucaoDefaults] = useState({})
  const [evolucaoFormSeed, setEvolucaoFormSeed] = useState(0)
  const [evolucaoActionId, setEvolucaoActionId] = useState(null)
  const [finalizarEvolucaoTarget, setFinalizarEvolucaoTarget] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    const role = getUserRole()
    if (role && !canAccessModule(role, 'prontuarios')) {
      router.replace('/agenda')
      return
    }
    if (prontuarioId) {
      loadProntuario()
    }
  }, [prontuarioId, router])

  const refreshEvolucoes = async () => {
    if (!prontuarioId) return
    try {
      const list = await prontuarioService.getEvolucoes(prontuarioId)
      setEvolucoes(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('Erro ao listar evoluções:', e)
    }
  }

  const loadProntuario = async () => {
    try {
      setLoading(true)
      const [prontuarioData, evolucoesList] = await Promise.all([
        prontuarioService.getById(prontuarioId),
        prontuarioService.getEvolucoes(prontuarioId).catch(() => []),
      ])
      setProntuario(prontuarioData)
      setEvolucoes(Array.isArray(evolucoesList) ? evolucoesList : [])

      if (prontuarioData.paciente_id) {
        const pacienteData = await pacienteService.getById(prontuarioData.paciente_id)
        setPaciente(pacienteData)
      }
    } catch (error) {
      console.error('❌ [PRONTUARIO DETAIL] Erro ao carregar prontuário:', error)
      showToast('Erro ao carregar prontuário', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleDelete = () => {
    setDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      await prontuarioService.delete(prontuarioId)
      router.push('/prontuarios')
    } catch (error) {
      console.error('❌ Erro ao excluir prontuário:', error)
      showToast('Erro ao excluir prontuário', 'error')
    }
  }

  const handleSave = async () => {
    setEditModalOpen(false)
    await loadProntuario()
  }

  const openNovaEvolucao = async () => {
    try {
      const ultima = await prontuarioService.getUltimaEvolucao(prontuarioId)
      setEditingEvolucao(null)
      setNovaEvolucaoDefaults(mapUltimaToFormDefaults(ultima))
      setEvolucaoFormSeed((s) => s + 1)
      setEvolucaoModalOpen(true)
    } catch (e) {
      showToast(e.message || 'Erro ao preparar nova evolução', 'error')
    }
  }

  const openEditEvolucao = (ev) => {
    setEditingEvolucao(ev)
    setEvolucaoModalOpen(true)
  }

  const closeEvolucaoModal = () => {
    setEvolucaoModalOpen(false)
    setEditingEvolucao(null)
  }

  const handleEvolucaoSaved = async () => {
    const wasEdit = Boolean(editingEvolucao)
    closeEvolucaoModal()
    await refreshEvolucoes()
    showToast(wasEdit ? 'Evolução atualizada' : 'Evolução registrada')
  }

  const confirmFinalizarEvolucao = async () => {
    const ev = finalizarEvolucaoTarget
    if (!ev) return
    try {
      setEvolucaoActionId(ev.id)
      await prontuarioService.finalizarEvolucao(prontuarioId, ev.id)
      setFinalizarEvolucaoTarget(null)
      showToast('Evolução finalizada')
      await refreshEvolucoes()
    } catch (e) {
      showToast(e.message || 'Erro ao finalizar', 'error')
    } finally {
      setEvolucaoActionId(null)
    }
  }

  const handleDeleteEvolucao = async (ev) => {
    if (!window.confirm('Excluir esta evolução? Esta ação não pode ser desfeita.')) return
    try {
      setEvolucaoActionId(ev.id)
      await prontuarioService.deleteEvolucao(prontuarioId, ev.id)
      showToast('Evolução excluída')
      await refreshEvolucoes()
    } catch (e) {
      showToast(e.message || 'Erro ao excluir', 'error')
    } finally {
      setEvolucaoActionId(null)
    }
  }

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true)
      
      // Fazer requisição para exportar PDF
      const response = await api.download(`/prontuarios/${prontuarioId}/export-pdf`)
      
      // Criar link para download
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      const pacienteNome = paciente?.nome_completo?.replace(/ /g, '_').toLowerCase() || 'prontuario'
      link.setAttribute('download', `prontuario_${pacienteNome}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      showToast('Erro ao exportar prontuário em PDF', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  if (!prontuario) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">
          Prontuário não encontrado
        </h2>
        <p className="text-neutral-600 mb-6">
          O prontuário que você está procurando não existe ou foi removido.
        </p>
        <Link href="/prontuarios">
          <Button variant="primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Prontuários
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:gap-4">
          <Link href="/prontuarios" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-9 px-2 sm:px-3">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-snug text-neutral-900 sm:text-xl md:text-2xl">
              {prontuario.titulo}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
              <User className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="truncate">{paciente?.nome_completo || 'Paciente não encontrado'}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
          <Button
            onClick={handleExportPdf}
            variant="outline"
            size="sm"
            title="Exportar PDF"
            className="!h-9 !min-h-0 py-2 text-[11px] sm:!h-11 sm:text-sm"
            icon={<FileDown className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
            disabled={exportingPdf}
          >
            {exportingPdf ? '...' : 'PDF'}
          </Button>
          <Button
            onClick={handleEdit}
            variant="secondary"
            size="sm"
            className="!h-9 !min-h-0 py-2 text-[11px] sm:!h-11 sm:text-sm"
            icon={<Edit className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
          >
            Editar
          </Button>
          <Button
            onClick={handleDelete}
            variant="danger"
            size="sm"
            className="!h-9 !min-h-0 py-2 text-[11px] sm:!h-11 sm:text-sm"
            icon={<Trash2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
          >
            Excluir
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descrição */}
          {prontuario.descricao && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-3 sm:text-lg">
                <FileText className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Descrição
              </h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap sm:text-base">{prontuario.descricao}</p>
            </div>
          )}

          {/* Queixas */}
          {prontuario.queixas && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-3 sm:text-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Queixas
              </h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap sm:text-base">{prontuario.queixas}</p>
            </div>
          )}

          {/* Diagnóstico Preliminar */}
          {prontuario.diagnostico_preliminar && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 text-base font-semibold text-neutral-900 sm:mb-3 sm:text-lg">
                Diagnóstico Preliminar
              </h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap sm:text-base">{prontuario.diagnostico_preliminar}</p>
            </div>
          )}

          {/* Histórico Clínico */}
          {prontuario.historico_clinico && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 text-base font-semibold text-neutral-900 sm:mb-3 sm:text-lg">
                Histórico Clínico
              </h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap sm:text-base">{prontuario.historico_clinico}</p>
            </div>
          )}

          {/* Alergias */}
          {prontuario.alergias && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-red-900 sm:mb-3 sm:text-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Alergias
              </h2>
              <p className="text-sm font-medium whitespace-pre-wrap text-red-800 sm:text-base">{prontuario.alergias}</p>
            </div>
          )}

          {/* Medicações */}
          {prontuario.medicacoes && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-3 sm:text-lg">
                <Pill className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Medicações
              </h2>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap sm:text-base">{prontuario.medicacoes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Informações do Paciente */}
          {paciente && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-4 sm:text-lg">
                <User className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Informações do Paciente
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Nome Completo</p>
                  <p className="text-sm font-medium text-neutral-900">{paciente.nome_completo}</p>
                </div>
                {paciente.cpf && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">CPF</p>
                    <p className="text-sm text-neutral-700">{paciente.cpf}</p>
                  </div>
                )}
                {paciente.data_nascimento && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Data de Nascimento</p>
                    <p className="text-sm text-neutral-700">
                      {(() => {
                        const date = parseDateSafe(paciente.data_nascimento)
                        return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                      })()}
                    </p>
                  </div>
                )}
                {paciente.telefone_principal && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Telefone</p>
                    <p className="text-sm text-neutral-700">{paciente.telefone_principal}</p>
                  </div>
                )}
                <Link 
                  href={`/pacientes/${paciente.id}`}
                  className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-200 bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400 px-3 py-1.5 text-sm w-full mt-2"
                >
                  Ver Perfil Completo
                </Link>
              </div>
            </div>
          )}

          {/* Metadados do Prontuário */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-4 sm:text-lg">
              <Clock className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              Informações do Registro
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500 mb-1">ID</p>
                <p className="text-sm text-neutral-700 font-mono break-all">{prontuario.id}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Criado em</p>
                <p className="text-sm text-neutral-700">
                  {(() => {
                    const date = parseDateSafe(prontuario.data_criacao)
                    return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida'
                  })()}
                </p>
              </div>
              {prontuario.data_atualizacao && prontuario.data_atualizacao !== prontuario.data_criacao && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Última atualização</p>
                  <p className="text-sm text-neutral-700">
                    {(() => {
                      const date = parseDateSafe(prontuario.data_atualizacao)
                      return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida'
                    })()}
                  </p>
                </div>
              )}
              {(prontuario.criado_por_nome || prontuario.criado_por) && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Criado por</p>
                  <p className="text-sm text-neutral-700 flex items-center gap-1">
                    <UserCircle className="w-4 h-4" />
                    {prontuario.criado_por_nome || prontuario.criado_por}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Agendamento Relacionado */}
          {prontuario.agendamento_id && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900 sm:mb-4 sm:text-lg">
                <Calendar className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Agendamento Relacionado
              </h2>
              <Link href={`/agendamentos/${prontuario.agendamento_id}`}>
                <Button variant="secondary" size="sm" className="w-full">
                  Ver Agendamento
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Evoluções clínicas */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:mt-8 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 sm:text-lg">
            <ClipboardList className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
            Evoluções
          </h2>
          <Button
            variant="primary"
            size="sm"
            className="w-full shrink-0 !h-9 py-2 text-xs sm:w-auto sm:!h-11 sm:text-sm"
            icon={<Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            onClick={openNovaEvolucao}
          >
            Nova evolução
          </Button>
        </div>

        {evolucoes.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4">
            Nenhuma evolução registrada. Use &quot;Nova evolução&quot; para começar — a última evolução sua será
            sugerida automaticamente.
          </p>
        ) : (
          <ul className="space-y-4">
            {evolucoes.map((ev) => {
              const user = getUser()
              const canEdit = canMutateEvolucao(ev, user)
              const busy = evolucaoActionId === ev.id
              const dataRef = ev.data_sessao || ev.data_criacao
              const dataLabel = (() => {
                const d = parseDateSafe(dataRef)
                return d ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'
              })()
              return (
                <li
                  key={ev.id}
                  className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-neutral-500">{dataLabel}</span>
                        {ev.imutavel && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" />
                            Finalizada
                          </span>
                        )}
                      </div>
                      {ev.titulo_resumo && (
                        <p className="font-medium text-neutral-900">{ev.titulo_resumo}</p>
                      )}
                      {ev.criado_por_nome && (
                        <p className="text-xs text-neutral-500 mt-1">Por {ev.criado_por_nome}</p>
                      )}
                      {(ev.humor || ev.comportamento) && (
                        <p className="text-xs text-neutral-600 mt-2">
                          {ev.humor && <span>Humor: {ev.humor}</span>}
                          {ev.humor && ev.comportamento && ' · '}
                          {ev.comportamento && <span>Comportamento: {ev.comportamento}</span>}
                        </p>
                      )}
                      {ev.conteudo && (
                        <p className="text-sm text-neutral-700 mt-2 whitespace-pre-wrap line-clamp-4">{ev.conteudo}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => openEditEvolucao(ev)}
                        >
                          Editar
                        </Button>
                        {!ev.imutavel && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setFinalizarEvolucaoTarget(ev)}
                          >
                            Finalizar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleDeleteEvolucao(ev)}
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        isOpen={Boolean(finalizarEvolucaoTarget)}
        onClose={() => setFinalizarEvolucaoTarget(null)}
        title="Finalizar evolução"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-1">
          <div className="flex justify-center">
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-700" />
            </div>
          </div>
          <p className="text-sm text-neutral-700 text-center">
            Depois de finalizar, esta evolução <strong>não poderá mais ser editada nem excluída</strong>. Deseja
            continuar?
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1"
              disabled={Boolean(evolucaoActionId)}
              onClick={() => setFinalizarEvolucaoTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={Boolean(evolucaoActionId)}
              onClick={confirmFinalizarEvolucao}
            >
              Finalizar
            </Button>
          </div>
        </div>
      </Modal>

      {evolucaoModalOpen && (
        <Modal
          isOpen={evolucaoModalOpen}
          onClose={closeEvolucaoModal}
          title={editingEvolucao ? 'Editar evolução' : 'Nova evolução'}
          size="md"
        >
          <EvolucaoForm
            key={editingEvolucao?.id || `nova-${evolucaoFormSeed}`}
            prontuarioId={prontuarioId}
            evolucao={editingEvolucao}
            defaultValues={novaEvolucaoDefaults}
            seed={evolucaoFormSeed}
            showTemplates={!editingEvolucao}
            onSuccess={handleEvolucaoSaved}
            onCancel={closeEvolucaoModal}
          />
        </Modal>
      )}

      {canAccessModule(getUserRole(), 'relatorios') && prontuario.paciente_id && (
      <div className="mt-6 sm:mt-8">
        <RelatoriosList pacienteId={prontuario.paciente_id} />
      </div>
      )}

      {/* Frequência de Atendimentos */}
      <div className="mt-6 sm:mt-8">
        <FrequenciaCard pacienteId={prontuario.paciente_id} />
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Editar Prontuário"
          size="large"
        >
          <ProntuarioForm
            prontuario={prontuario}
            onSuccess={handleSave}
            onCancel={() => setEditModalOpen(false)}
          />
        </Modal>
      )}

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Excluir Prontuário"
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">Tem certeza que deseja excluir este prontuário?</p>
            <p className="text-sm text-neutral-500 mt-1">Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDeleteConfirm(false)}
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
