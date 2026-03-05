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
  FileDown
} from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import ProntuarioForm from '@/components/prontuarios/ProntuarioForm'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { api } from '@/lib/api'
import { parseDateSafe } from '@/lib/dateUtils'

export default function ProntuarioDetailPage() {
  const params = useParams()
  const router = useRouter()
  const prontuarioId = params.id
  
  const [prontuario, setProntuario] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    if (prontuarioId) {
      loadProntuario()
    }
  }, [prontuarioId])

  const loadProntuario = async () => {
    try {
      setLoading(true)
      console.log('📚 [PRONTUARIO DETAIL] Carregando prontuário:', prontuarioId)
      
      // Buscar prontuário por ID usando a função RPC
      const prontuarioData = await prontuarioService.getById(prontuarioId)
      console.log('📚 [PRONTUARIO DETAIL] Dados recebidos:', prontuarioData)
      
      setProntuario(prontuarioData)
      
      // Se tiver paciente_id, buscar dados do paciente
      if (prontuarioData.paciente_id) {
        const pacienteData = await pacienteService.getById(prontuarioData.paciente_id)
        setPaciente(pacienteData)
      }
    } catch (error) {
      console.error('❌ [PRONTUARIO DETAIL] Erro ao carregar prontuário:', error)
      alert('Erro ao carregar prontuário')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleDelete = async () => {
    if (!confirm('Deseja realmente excluir este prontuário?')) return

    try {
      await prontuarioService.delete(prontuarioId)
      router.push('/prontuarios')
    } catch (error) {
      console.error('❌ Erro ao excluir prontuário:', error)
      alert('Erro ao excluir prontuário')
    }
  }

  const handleSave = async () => {
    setEditModalOpen(false)
    await loadProntuario()
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
      alert('Erro ao exportar prontuário em PDF')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/prontuarios">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{prontuario.titulo}</h1>
            <p className="text-neutral-600 mt-1 flex items-center gap-2">
              <User className="w-4 h-4" />
              {paciente?.nome_completo || 'Paciente não encontrado'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleExportPdf} 
            variant="outline" 
            icon={<FileDown className="w-4 h-4" />}
            disabled={exportingPdf}
          >
            {exportingPdf ? 'Gerando...' : 'Exportar PDF'}
          </Button>
          <Button onClick={handleEdit} variant="secondary" icon={<Edit className="w-4 h-4" />}>
            Editar
          </Button>
          <Button onClick={handleDelete} variant="danger" icon={<Trash2 className="w-4 h-4" />}>
            Excluir
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descrição */}
          {prontuario.descricao && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Descrição
              </h2>
              <p className="text-neutral-700 whitespace-pre-wrap">{prontuario.descricao}</p>
            </div>
          )}

          {/* Diagnóstico Preliminar */}
          {prontuario.diagnostico_preliminar && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-3">
                Diagnóstico Preliminar
              </h2>
              <p className="text-neutral-700 whitespace-pre-wrap">{prontuario.diagnostico_preliminar}</p>
            </div>
          )}

          {/* Histórico Clínico */}
          {prontuario.historico_clinico && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-3">
                Histórico Clínico
              </h2>
              <p className="text-neutral-700 whitespace-pre-wrap">{prontuario.historico_clinico}</p>
            </div>
          )}

          {/* Alergias */}
          {prontuario.alergias && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200 bg-red-50">
              <h2 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Alergias
              </h2>
              <p className="text-red-800 whitespace-pre-wrap font-medium">{prontuario.alergias}</p>
            </div>
          )}

          {/* Medicações */}
          {prontuario.medicacoes && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <Pill className="w-5 h-5" />
                Medicações
              </h2>
              <p className="text-neutral-700 whitespace-pre-wrap">{prontuario.medicacoes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Informações do Paciente */}
          {paciente && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
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
          <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
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
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
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

      {/* Relatórios do Paciente */}
      <div className="mt-8">
        <RelatoriosList pacienteId={prontuario.paciente_id} />
      </div>

      {/* Frequência de Atendimentos */}
      <div className="mt-8">
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
    </div>
  )
}
