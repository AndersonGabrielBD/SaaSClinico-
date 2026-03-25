'use client'

import { User, Phone, Mail, Calendar, Edit, UserX, UserCheck, FileText, Users, Eye } from 'lucide-react'
import Button from '@/components/common/Button'
import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { getUserRole } from '@/utils/auth'
import { canPerformAction, canAccessModule } from '@/utils/roles'
import { useState, useEffect } from 'react'
import { pacienteService } from '@/services/pacienteService'

const safeParseDate = (dateValue) => {
  if (!dateValue) return null
  try {
    let date
    if (typeof dateValue === 'string') {
      const isoString = dateValue.includes(' ') ? dateValue.replace(' ', 'T') : dateValue
      const fullIsoString = isoString.includes('T') ? isoString : `${isoString}T00:00:00`
      date = parseISO(fullIsoString)
    } else {
      date = new Date(dateValue)
    }
    return isValid(date) ? date : null
  } catch (error) {
    return null
  }
}

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
  const canSeeProntuarios = canAccessModule(userRole, 'prontuarios')
  
  const [profissionais, setProfissionais] = useState([])
  const [loadingProf, setLoadingProf] = useState(false)

  useEffect(() => {
    if (paciente?.id) loadProfissionais()
  }, [paciente?.id])

  const loadProfissionais = async () => {
    try {
      setLoadingProf(true)
      const data = await pacienteService.getProfissionais(paciente.id)
      setProfissionais(data)
    } catch (error) {
      // silently fail
    } finally {
      setLoadingProf(false)
    }
  }

  const initials = paciente.nome_completo
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  
  return (
    <div className={`
      bg-white rounded-2xl border transition-all duration-200 group
      ${paciente.ativo ? 'border-neutral-100 hover:border-primary-200 hover:shadow-card-hover' : 'border-neutral-200 opacity-70'}
      shadow-card animate-fade-in
    `}>
      <div className="flex items-start gap-4 p-5 pb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold
          ${paciente.ativo 
            ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white' 
            : 'bg-neutral-200 text-neutral-500'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 leading-tight truncate">
                {paciente.nome_completo}
              </h3>
              {paciente.cpf && (
                <p className="text-xs text-neutral-400 mt-0.5">CPF {paciente.cpf}</p>
              )}
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide flex-shrink-0
              ${paciente.ativo ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
              {paciente.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 space-y-2">
        {paciente.data_nascimento && (() => {
          const birthDate = safeParseDate(paciente.data_nascimento)
          const age = calculateAge(paciente.data_nascimento)
          if (!birthDate) return null
          return (
            <div className="flex items-center gap-2.5 text-xs text-neutral-500">
              <div className="w-6 h-6 rounded-lg bg-neutral-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 text-neutral-400" />
              </div>
              <span>{format(birthDate, "dd/MM/yyyy", { locale: ptBR })}{age !== null && ` · ${age} anos`}</span>
            </div>
          )
        })()}

        {paciente.telefone_principal && (
          <div className="flex items-center gap-2.5 text-xs text-neutral-500">
            <div className="w-6 h-6 rounded-lg bg-neutral-50 flex items-center justify-center flex-shrink-0">
              <Phone className="w-3 h-3 text-neutral-400" />
            </div>
            <span>{paciente.telefone_principal}</span>
          </div>
        )}

        {paciente.email && (
          <div className="flex items-center gap-2.5 text-xs text-neutral-500">
            <div className="w-6 h-6 rounded-lg bg-neutral-50 flex items-center justify-center flex-shrink-0">
              <Mail className="w-3 h-3 text-neutral-400" />
            </div>
            <span className="truncate">{paciente.email}</span>
          </div>
        )}

        {paciente.responsavel_nome && (
          <div className="flex items-center gap-2.5 text-xs text-neutral-500 pt-1">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-3 h-3 text-blue-400" />
            </div>
            <span>Resp: {paciente.responsavel_nome}</span>
          </div>
        )}

        {!loadingProf && profissionais.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {profissionais.map((prof) => (
              <span key={prof.id}
                className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-[10px] font-semibold"
                title={prof.especialidade || ''}>
                {prof.nome_completo.split(' ')[0]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-neutral-50 rounded-b-2xl">
        <Link href={`/pacientes/${paciente.id}`}>
          <Button size="sm" variant="primary" icon={<Eye className="w-3.5 h-3.5" />}>Perfil</Button>
        </Link>
        {canSeeProntuarios && (
        <Link href={`/prontuarios?paciente_id=${paciente.id}`}>
          <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}>Prontuários</Button>
        </Link>
        )}
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
