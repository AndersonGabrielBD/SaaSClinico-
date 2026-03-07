'use client'

import { User, Phone, Mail, Calendar, Edit, UserX, UserCheck, FileText, Users, Eye } from 'lucide-react'
import Button from '@/components/common/Button'
import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { getUserRole } from '@/utils/auth'
import { canPerformAction } from '@/utils/roles'
import { useState, useEffect } from 'react'
import { pacienteService } from '@/services/pacienteService'

// Helper function to safely parse dates
const safeParseDate = (dateValue) => {
  if (!dateValue) return null
  
  try {
    let date
    if (typeof dateValue === 'string') {
      // Se tem espaço, substituir por T para ISO format
      const isoString = dateValue.includes(' ') ? dateValue.replace(' ', 'T') : dateValue
      // Se não tem horário, adicionar
      const fullIsoString = isoString.includes('T') ? isoString : `${isoString}T00:00:00`
      date = parseISO(fullIsoString)
    } else {
      date = new Date(dateValue)
    }
    
    return isValid(date) ? date : null
  } catch (error) {
    console.error('Erro ao fazer parse da data:', dateValue, error)
    return null
  }
}

// Helper function to calculate age
const calculateAge = (birthDate) => {
  const date = safeParseDate(birthDate)
  if (!date) return null
  
  const today = new Date()
  const age = Math.floor((today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return age >= 0 ? age : null
}

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
      bg-white rounded-xl border transition-all duration-150
      ${paciente.ativo ? 'border-neutral-100 hover:border-neutral-200 hover:shadow-md' : 'border-neutral-200 bg-neutral-50/50 opacity-80'}
      shadow-[0_1px_3px_rgba(0,0,0,0.05)]
    `}>
      {/* Card header */}
      <div className="flex items-start justify-between p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            ${paciente.ativo ? 'bg-primary-50' : 'bg-neutral-200'}`}>
            <User className={`w-5 h-5 ${paciente.ativo ? 'text-primary-600' : 'text-neutral-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
              {paciente.nome_completo}
            </h3>
            {paciente.cpf && (
              <p className="text-xs text-neutral-400 mt-0.5">CPF {paciente.cpf}</p>
            )}
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide
          ${paciente.ativo ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'}`}>
          {paciente.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Info rows */}
      <div className="px-5 pb-4 space-y-2 border-t border-neutral-50 pt-3">
        {paciente.data_nascimento && (() => {
          const birthDate = safeParseDate(paciente.data_nascimento)
          const age = calculateAge(paciente.data_nascimento)
          if (!birthDate) return null
          return (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-neutral-300" />
              <span>{format(birthDate, "dd/MM/yyyy", { locale: ptBR })}{age !== null && ` · ${age} anos`}</span>
            </div>
          )
        })()}

        {paciente.telefone_principal && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-neutral-300" />
            <span>{paciente.telefone_principal}</span>
          </div>
        )}

        {paciente.email && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Mail className="w-3.5 h-3.5 flex-shrink-0 text-neutral-300" />
            <span className="truncate">{paciente.email}</span>
          </div>
        )}

        {paciente.responsavel_nome && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 pt-1 border-t border-neutral-50">
            <Users className="w-3.5 h-3.5 flex-shrink-0 text-neutral-300" />
            <span>Resp: {paciente.responsavel_nome}</span>
          </div>
        )}

        {!loadingProf && profissionais.length > 0 && (
          <div className="pt-1 border-t border-neutral-50">
            <div className="flex flex-wrap gap-1 mt-1">
              {profissionais.map((prof) => (
                <span key={prof.id}
                  className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-[10px] font-medium"
                  title={prof.especialidade || ''}>
                  {prof.nome_completo.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-neutral-50 bg-neutral-50/50 rounded-b-xl">
        <Link href={`/pacientes/${paciente.id}`}>
          <Button size="sm" variant="primary" icon={<Eye className="w-3.5 h-3.5" />}>Perfil</Button>
        </Link>
        <Link href={`/prontuarios?paciente_id=${paciente.id}`}>
          <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}>Prontuários</Button>
        </Link>
        {paciente.ativo ? (
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(paciente)} icon={<Edit className="w-3.5 h-3.5" />}>Editar</Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={() => onDeactivate(paciente.id)} icon={<UserX className="w-3.5 h-3.5" />} className="text-red-500 hover:text-red-600 hover:bg-red-50">Desativar</Button>
            )}
          </div>
        ) : (
          canEdit && (
            <Button size="sm" variant="ghost" onClick={() => onReactivate(paciente.id)} icon={<UserCheck className="w-3.5 h-3.5" />} className="ml-auto">Reativar</Button>
          )
        )}
      </div>
    </div>
  )
}
