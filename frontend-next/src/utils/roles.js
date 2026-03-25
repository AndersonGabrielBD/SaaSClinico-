// filepath: frontend-next/src/utils/roles.js

/**
 * Utilitários para controle de acesso baseado em roles
 */

// Definição de roles
export const ROLES = {
  ADMIN: 'admin',
  RECEPCAO: 'recepcao',
  FONO: 'fono',
  MEDICO: 'medico',
  PROFISSIONAL: 'profissional' // Alias para fono/medico
};

// Mapeamento de roles para nomes amigáveis
export const ROLE_NAMES = {
  admin: 'Administrador',
  recepcao: 'Recepcionista',
  fono: 'Fonoaudiólogo',
  medico: 'Médico',
  profissional: 'Profissional'
};

// Definição de permissões por módulo
const PERMISSIONS = {
  dashboard: ['admin'],
  pacientes: {
    view: ['admin', 'recepcao', 'fono', 'medico', 'profissional'],
    create: ['admin', 'recepcao'],
    edit: ['admin', 'recepcao'],
    delete: ['admin']
  },
  agenda: {
    view: ['admin', 'recepcao', 'fono', 'medico', 'profissional'],
    create: ['admin', 'recepcao'],
    edit: ['admin', 'recepcao'],
    delete: ['admin', 'recepcao']
  },
  prontuarios: {
    view: ['admin', 'fono', 'medico', 'profissional'],
    create: ['fono', 'medico', 'profissional'],
    edit: ['fono', 'medico', 'profissional'],
    delete: ['admin', 'fono', 'medico', 'profissional']
  },
  relatorios: {
    view: ['admin', 'fono', 'medico', 'profissional'],
    create: ['admin', 'fono', 'medico', 'profissional'],
    edit: ['admin', 'fono', 'medico', 'profissional'],
    delete: ['admin', 'fono', 'medico', 'profissional']
  },
  financeiro: {
    view: ['admin', 'recepcao'],
    create: ['admin', 'recepcao'],
    edit: ['admin', 'recepcao'],
    delete: ['admin']
  },
  frequencia: {
    view: ['admin', 'recepcao', 'fono', 'medico', 'profissional'],
    create: ['fono', 'medico', 'profissional'],
    edit: ['fono', 'medico', 'profissional'],
    delete: ['admin']
  },
  usuarios: {
    view: ['admin', 'recepcao'],
    create: ['admin'],
    edit: ['admin'],
    delete: ['admin']
  },
  salas: {
    view: ['admin', 'recepcao'],
    create: ['admin', 'recepcao'],
    edit: ['admin', 'recepcao'],
    delete: ['admin']
  },
  tipos_atendimento: {
    view: ['admin', 'recepcao'],
    create: ['admin', 'recepcao'],
    edit: ['admin', 'recepcao'],
    delete: ['admin', 'recepcao']
  },
  configuracoes: ['admin']
};

/**
 * Verifica se o usuário tem uma role específica
 */
export function hasRole(userRole, allowedRoles) {
  if (!userRole || !allowedRoles) return false;
  
  const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedUserRole = userRole.toLowerCase();
  
  return rolesList.some(role => role.toLowerCase() === normalizedUserRole);
}

/**
 * Verifica se o usuário pode acessar um módulo
 */
export function canAccessModule(userRole, module) {
  if (!userRole || !module) return false;
  
  const modulePermissions = PERMISSIONS[module];
  
  if (!modulePermissions) return false;
  
  // Se for um array simples, verificar acesso direto
  if (Array.isArray(modulePermissions)) {
    return hasRole(userRole, modulePermissions);
  }
  
  // Se for objeto, verificar permissão 'view'
  if (typeof modulePermissions === 'object' && modulePermissions.view) {
    return hasRole(userRole, modulePermissions.view);
  }
  
  return false;
}

/**
 * Verifica se o usuário pode realizar uma ação específica
 */
export function canPerformAction(userRole, module, action) {
  if (!userRole || !module || !action) return false;
  
  const modulePermissions = PERMISSIONS[module];
  
  if (!modulePermissions) return false;
  
  // Se for um array simples, todas as ações são permitidas
  if (Array.isArray(modulePermissions)) {
    return hasRole(userRole, modulePermissions);
  }
  
  // Se for objeto, verificar ação específica
  if (typeof modulePermissions === 'object' && modulePermissions[action]) {
    return hasRole(userRole, modulePermissions[action]);
  }
  
  return false;
}

/**
 * Retorna itens de menu permitidos para o usuário
 */
export function getMenuItemsForRole(userRole) {
  const allMenuItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: 'LayoutDashboard',
      module: 'dashboard'
    },
    {
      name: 'Pacientes',
      href: '/pacientes',
      icon: 'Users',
      module: 'pacientes'
    },
    {
      name: 'Agenda',
      href: '/agenda',
      icon: 'Calendar',
      module: 'agenda'
    },
    {
      name: 'Prontuários',
      href: '/prontuarios',
      icon: 'FileText',
      module: 'prontuarios'
    },
    {
      name: 'Financeiro',
      href: '/financeiro',
      icon: 'DollarSign',
      module: 'financeiro'
    },
    {
      name: 'Configurações',
      href: '/configuracoes',
      icon: 'Settings',
      module: 'configuracoes'
    }
  ];
  
  return allMenuItems.filter(item => canAccessModule(userRole, item.module));
}

/**
 * Verifica se o usuário é admin
 */
export function isAdmin(userRole) {
  return userRole?.toLowerCase() === 'admin';
}

/**
 * Verifica se o usuário é recepcao
 */
export function isRecepcao(userRole) {
  return userRole?.toLowerCase() === 'recepcao';
}

/**
 * Verifica se o usuário é profissional (fono ou medico)
 */
export function isProfissional(userRole) {
  const role = userRole?.toLowerCase();
  return role === 'fono' || role === 'medico' || role === 'profissional';
}

/**
 * Verifica se o usuário é admin ou recepcao (acesso administrativo)
 */
export function hasAdminAccess(userRole) {
  return isAdmin(userRole) || isRecepcao(userRole);
}

/**
 * Retorna o nome amigável da role
 */
export function getRoleName(role) {
  if (!role) return 'Usuário';
  return ROLE_NAMES[role.toLowerCase()] || role;
}

/** Primeira rota após login / clique no logo (recepção não tem dashboard). */
export function getDefaultHomePath(userRole) {
  if (!userRole) return '/login';
  if (canAccessModule(userRole, 'dashboard')) return '/dashboard';
  return '/agenda';
}
