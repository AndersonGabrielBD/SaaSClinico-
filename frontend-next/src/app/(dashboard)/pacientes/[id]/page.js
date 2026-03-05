'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { pacienteService } from '@/services/pacienteService'
import { prontuarioService } from '@/services/prontuarioService'
import Link from 'next/link'
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin,
  FileText,
  Edit,
  UserCircle,
  Clock,
  CreditCard,
  AlertTriangle
} from 'lucide-react'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { LoadingSkeleton } from '@/components/common/LoadingSpinner'
import PacienteForm from '@/components/pacientes/PacienteForm'
import RelatoriosList from '@/components/relatorios/RelatoriosList'
import FrequenciaCard from '@/components/frequencia/FrequenciaCard'
import { format, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseDateSafe } from '@/lib/dateUtils'

export default function PacienteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const pacienteId = params.id
  
  const [paciente, setPaciente] = useState(null)
  const [prontuarios, setProntuarios] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)

  useEffect(() => {
    if (pacienteId) {
      loadPaciente()
    }
  }, [pacienteId])

  const loadPaciente = async () => {
    try {
      setLoading(true)
      
      // Buscar dados do paciente
      const pacienteData = await pacienteService.getById(pacienteId)
      setPaciente(pacienteData)
      
      // Buscar prontuários do paciente
      const prontuariosData = await prontuarioService.getAll({ paciente_id: pacienteId })
      setProntuarios(prontuariosData)
      
      // Buscar estatísticas
      const statsData = await pacienteService.getStats(pacienteId)
      setStats(statsData)
    } catch (error) {
      console.error('Erro ao carregar paciente:', error)
      alert('Erro ao carregar dados do paciente')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleSave = async () => {
    setEditModalOpen(false)
    await loadPaciente()
  }

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return null
    return differenceInYears(new Date(), new Date(dataNascimento))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">
          Paciente não encontrado
        </h2>
        <p className="text-neutral-600 mb-6">
          O paciente que você está procurando não existe ou foi removido.
        </p>
        <Link href="/pacientes">
          <Button variant="primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Pacientes
          </Button>
        </Link>
      </div>
    )
  }

  const idade = calcularIdade(paciente.data_nascimento)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/pacientes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <UserCircle className="w-10 h-10 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{paciente.nome_completo}</h1>
              <div className="flex items-center gap-3 mt-1">
                {idade && (
                  <span className="text-neutral-600">{idade} anos</span>
                )}
                {!paciente.ativo && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    Inativo
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <Button onClick={handleEdit} variant="secondary" icon={<Edit className="w-4 h-4" />}>
          Editar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
            <p className="text-sm text-neutral-600">Total Consultas</p>
            <p className="text-2xl font-bold text-neutral-900">{stats.total_consultas}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
            <p className="text-sm text-neutral-600">Realizadas</p>
            <p className="text-2xl font-bold text-green-600">{stats.consultas_realizadas}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
            <p className="text-sm text-neutral-600">Canceladas</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.consultas_canceladas}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-neutral-200">
            <p className="text-sm text-neutral-600">Faltas</p>
            <p className="text-2xl font-bold text-red-600">{stats.consultas_faltou}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Pessoais */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados Pessoais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {idade && ` (${idade} anos)`}
                  </p>
                </div>
              )}
              {paciente.sexo && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Sexo</p>
                  <p className="text-sm text-neutral-700">
                    {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contato */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Contato
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paciente.telefone_principal && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Telefone Principal</p>
                  <p className="text-sm text-neutral-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {paciente.telefone_principal}
                  </p>
                </div>
              )}
              {paciente.telefone_secundario && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Telefone Secundário</p>
                  <p className="text-sm text-neutral-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {paciente.telefone_secundario}
                  </p>
                </div>
              )}
              {paciente.email && (
                <div className="md:col-span-2">
                  <p className="text-xs text-neutral-500 mb-1">E-mail</p>
                  <p className="text-sm text-neutral-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {paciente.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Endereço */}
          {(paciente.endereco || paciente.cidade || paciente.estado) && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paciente.endereco && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-neutral-500 mb-1">Endereço</p>
                    <p className="text-sm text-neutral-700">{paciente.endereco}</p>
                  </div>
                )}
                {paciente.cidade && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Cidade</p>
                    <p className="text-sm text-neutral-700">{paciente.cidade}</p>
                  </div>
                )}
                {paciente.estado && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Estado</p>
                    <p className="text-sm text-neutral-700">{paciente.estado}</p>
                  </div>
                )}
                {paciente.cep && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">CEP</p>
                    <p className="text-sm text-neutral-700">{paciente.cep}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Observações */}
          {paciente.observacoes && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Observações
              </h2>
              <p className="text-neutral-700 whitespace-pre-wrap">{paciente.observacoes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Prontuários */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Prontuários
            </h2>
            {prontuarios.length > 0 ? (
              <div className="space-y-3">
                {prontuarios.slice(0, 5).map((p) => (
                  <Link 
                    key={p.id} 
                    href={`/prontuarios/${p.id}`}
                    className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <p className="text-sm font-medium text-neutral-900">{p.titulo}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {(() => {
                        const date = parseDateSafe(p.data_criacao)
                        return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                      })()}
                    </p>
                  </Link>
                ))}
                {prontuarios.length > 5 && (
                  <p className="text-xs text-neutral-500 text-center">
                    E mais {prontuarios.length - 5} prontuário(s)...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nenhum prontuário registrado</p>
            )}
            <Link 
              href={`/prontuarios?paciente_id=${pacienteId}`}
              className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-200 bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400 px-3 py-1.5 text-sm w-full mt-4"
            >
              Ver Todos os Prontuários
            </Link>
          </div>

          {/* Metadados */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Informações do Registro
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Cadastrado em</p>
                <p className="text-sm text-neutral-700">
                  {paciente.created_at && (() => {
                    const date = parseDateSafe(paciente.created_at)
                    return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida'
                  })()}
                </p>
              </div>
              {paciente.updated_at && paciente.updated_at !== paciente.created_at && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Última atualização</p>
                  <p className="text-sm text-neutral-700">
                    {(() => {
                      const date = parseDateSafe(paciente.updated_at)
                      return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida'
                    })()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-neutral-500 mb-1">Status</p>
                <p className={`text-sm font-medium ${paciente.ativo ? 'text-green-600' : 'text-red-600'}`}>
                  {paciente.ativo ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>
          </div>

          {/* Responsável Financeiro */}
          {(paciente.responsavel_nome || paciente.responsavel_cpf) && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Responsável Financeiro
              </h2>
              <div className="space-y-3">
                {paciente.responsavel_nome && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Nome</p>
                    <p className="text-sm text-neutral-700">{paciente.responsavel_nome}</p>
                  </div>
                )}
                {paciente.responsavel_cpf && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">CPF</p>
                    <p className="text-sm text-neutral-700">{paciente.responsavel_cpf}</p>
                  </div>
                )}
                {paciente.responsavel_telefone && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Telefone</p>
                    <p className="text-sm text-neutral-700">{paciente.responsavel_telefone}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Relatórios do Paciente */}
      <div className="mt-8">
        <RelatoriosList pacienteId={pacienteId} />
      </div>

      {/* Frequência de Atendimentos */}
      <div className="mt-8">
        <FrequenciaCard pacienteId={pacienteId} />
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Editar Paciente"
          size="large"
        >
          <PacienteForm
            paciente={paciente}
            onSuccess={handleSave}
            onCancel={() => setEditModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  )
}
