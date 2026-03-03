'use client'

import { FileText, User, Calendar, Edit, Trash2, Eye, Lock } from 'lucide-react'
import Button from '@/components/common/Button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

export default function ProntuarioCard({
  prontuario,
  onEdit,
  onDelete
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                {prontuario.titulo}
              </h3>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <User className="w-4 h-4" />
                <span className="font-medium">{prontuario.paciente?.nome_completo}</span>
              </div>
            </div>

            {prontuario.visivel_para_paciente && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Visível
              </span>
            )}
          </div>

          {prontuario.descricao && (
            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
              {prontuario.descricao}
            </p>
          )}

          {prontuario.diagnostico_preliminar && (
            <div className="mb-3">
              <p className="text-xs text-neutral-500 mb-1">Diagnóstico Preliminar:</p>
              <p className="text-sm text-neutral-700 font-medium">
                {prontuario.diagnostico_preliminar}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-neutral-500 mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                Criado em {format(new Date(prontuario.data_criacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {prontuario.criado_por_usuario && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>por {prontuario.criado_por_usuario.nome_completo}</span>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-neutral-50 rounded-lg mb-4">
            {prontuario.historico_clinico && (
              <div>
                <p className="text-xs text-neutral-500">Histórico Clínico</p>
                <p className="text-sm text-neutral-700 truncate">Sim</p>
              </div>
            )}
            {prontuario.alergias && (
              <div>
                <p className="text-xs text-neutral-500">Alergias</p>
                <p className="text-sm text-red-600 truncate">{prontuario.alergias}</p>
              </div>
            )}
            {prontuario.medicacoes && (
              <div>
                <p className="text-xs text-neutral-500">Medicações</p>
                <p className="text-sm text-neutral-700 truncate">{prontuario.medicacoes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/prontuarios/${prontuario.id}`}>
              <Button
                size="sm"
                variant="primary"
                icon={<Eye className="w-4 h-4" />}
              >
                Ver Detalhes
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(prontuario)}
              icon={<Edit className="w-4 h-4" />}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(prontuario.id)}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
