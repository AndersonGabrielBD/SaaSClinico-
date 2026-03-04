'use client'

import { User, Phone, Mail, Calendar, Edit, UserX, UserCheck, FileText, Users, Eye } from 'lucide-react'
import Button from '@/components/common/Button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { getUserRole } from '@/utils/auth'
import { canPerformAction } from '@/utils/roles'
import { useState, useEffect } from 'react'
import { pacienteService } from '@/services/pacienteService'

export default function PacienteCard({
  paciente,
  onEdit,
  onDeactivate,
  onReactivate
}) {
  const userRole = getUserRole()
  const canEdit = canPerformAction(userRole, 'pacientes', 'edit')
  const canDelete = canPerformAction(userRole, 'pacientes', 'delete')
  
  const [profissionais, setProfissionais] = useState([])
  const [loadingProf, setLoadingProf] = useState(false)

  useEffect(() => {
    if (paciente?.id) {
      loadProfissionais()
    }
  }, [paciente?.id])

  const loadProfissionais = async () => {
    try {
      setLoadingProf(true)
      const data = await pacienteService.getProfissionais(paciente.id)
      setProfissionais(data)
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error)
    } finally {
      setLoadingProf(false)
    }
  }
  
  return (
    <div className={`
      bg-white rounded-lg p-6 shadow-sm border 
      ${paciente.ativo ? 'border-neutral-200' : 'border-neutral-300 bg-neutral-50'}
      hover:shadow-md transition-shadow
    `}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center
            ${paciente.ativo ? 'bg-primary-100' : 'bg-neutral-200'}
          `}>
            <User className={`w-6 h-6 ${paciente.ativo ? 'text-primary-600' : 'text-neutral-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {paciente.nome_completo}
            </h3>
            {paciente.cpf && (
              <p className="text-sm text-neutral-500">
                CPF: {paciente.cpf}
              </p>
            )}
          </div>
        </div>
        
        <span className={`
          px-3 py-1 rounded-full text-xs font-medium
          ${paciente.ativo 
            ? 'bg-green-100 text-green-700' 
            : 'bg-neutral-200 text-neutral-600'}
        `}>
          {paciente.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        {paciente.data_nascimento && (
          <div className="flex items-center gap-2 text-neutral-600">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(paciente.data_nascimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {' '}({Math.floor((new Date().getTime() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} anos)
            </span>
          </div>
        )}

        {paciente.telefone_principal && (
          <div className="flex items-center gap-2 text-neutral-600">
            <Phone className="w-4 h-4" />
            <span>{paciente.telefone_principal}</span>
          </div>
        )}

        {paciente.email && (
          <div className="flex items-center gap-2 text-neutral-600">
            <Mail className="w-4 h-4" />
            <span>{paciente.email}</span>
          </div>
        )}

        {paciente.endereco && (
          <div className="text-neutral-600 mt-2">
            <p className="text-xs text-neutral-500">Endereço:</p>
            <p>
              {paciente.endereco}
              {paciente.numero && `, ${paciente.numero}`}
              {paciente.complemento && ` - ${paciente.complemento}`}
            </p>
            {(paciente.cidade || paciente.estado) && (
              <p>
                {paciente.cidade}{paciente.estado && ` - ${paciente.estado}`}
              </p>
            )}
          </div>
        )}

        {paciente.responsavel_nome && (
          <div className="mt-3 pt-3 border-t border-neutral-200">
            <p className="text-xs text-neutral-500 mb-1">Responsável:</p>
            <p className="font-medium">{paciente.responsavel_nome}</p>
            {paciente.responsavel_telefone && (
              <p className="text-neutral-600">{paciente.responsavel_telefone}</p>
            )}
          </div>
        )}

        {/* Profissionais Vinculados */}
        {!loadingProf && profissionais.length > 0 && (
          <div className="mt-3 pt-3 border-t border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-neutral-500" />
              <p className="text-xs font-medium text-neutral-700">
                Profissionais Responsáveis:
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profissionais.map((prof) => (
                <span
                  key={prof.id}
                  className="inline-flex items-center px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs"
                  title={prof.especialidade || ''}
                >
                  {prof.nome_completo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-200">
        <Link href={`/pacientes/${paciente.id}`}>
          <Button
            size="sm"
            variant="primary"
            icon={<Eye className="w-4 h-4" />}
          >
            Ver Perfil
          </Button>
        </Link>

        <Link href={`/prontuarios?paciente_id=${paciente.id}`}>
          <Button
            size="sm"
            variant="secondary"
            icon={<FileText className="w-4 h-4" />}
          >
            Prontuários
          </Button>
        </Link>
        
        {paciente.ativo ? (
          <>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(paciente)}
                icon={<Edit className="w-4 h-4" />}
              >
                Editar
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDeactivate(paciente.id)}
                icon={<UserX className="w-4 h-4" />}
              >
                Desativar
              </Button>
            )}
          </>
        ) : (
          canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onReactivate(paciente.id)}
              icon={<UserCheck className="w-4 h-4" />}
            >
              Reativar
            </Button>
          )
        )}
      </div>
    </div>
  )
}
