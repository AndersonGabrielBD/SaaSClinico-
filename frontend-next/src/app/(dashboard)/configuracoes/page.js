'use client'

import { Settings as SettingsIcon } from 'lucide-react'

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <SettingsIcon className="w-24 h-24 text-neutral-400 mb-6" />
      <h1 className="text-3xl font-bold text-neutral-900 mb-3">
        Configurações
      </h1>
      <p className="text-neutral-600 max-w-md mb-6">
        Esta funcionalidade está em desenvolvimento e estará disponível em breve.
        Aqui você poderá gerenciar configurações gerais da clínica, usuários e permissões.
      </p>
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 max-w-md">
        <h3 className="font-semibold text-primary-900 mb-2">Recursos Planejados:</h3>
        <ul className="text-sm text-primary-800 text-left space-y-1">
          <li>• Dados da clínica</li>
          <li>• Gestão de usuários e permissões (RBAC)</li>
          <li>• Configuração de salas e recursos</li>
          <li>• Tipos de atendimento e serviços</li>
          <li>• Integração com sistemas externos</li>
          <li>• Preferências e notificações</li>
        </ul>
      </div>
    </div>
  )
}
