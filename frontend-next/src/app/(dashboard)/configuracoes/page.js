'use client'

import { Settings as SettingsIcon, Users, Building2, Bell, Shield, Palette } from 'lucide-react'

export default function ConfiguracoesPage() {
  const features = [
    { icon: Building2, label: 'Dados da clínica', description: 'Nome, endereço, CNPJ e informações gerais' },
    { icon: Users, label: 'Usuários e permissões', description: 'Gerencie acessos e papéis (RBAC)' },
    { icon: Bell, label: 'Notificações', description: 'Configure alertas e lembretes' },
    { icon: Shield, label: 'Segurança', description: 'Senhas, autenticação e logs de acesso' },
    { icon: Palette, label: 'Personalização', description: 'Aparência e preferências do sistema' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gerencie as configurações do sistema</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center mb-6">
            <SettingsIcon className="w-10 h-10 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Em Desenvolvimento</h2>
          <p className="text-neutral-500 max-w-md mb-8 leading-relaxed">
            Esta funcionalidade estará disponível em breve. Aqui você poderá gerenciar todas as configurações da clínica.
          </p>
        </div>

        <div className="border-t border-neutral-100 px-6 py-6">
          <h3 className="text-sm font-bold text-neutral-800 mb-4 uppercase tracking-wide">Recursos Planejados</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
