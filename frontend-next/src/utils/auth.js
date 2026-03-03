// Auth utilities
// Gerenciamento de autenticação e token

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

export function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export function getUser() {
  if (typeof window === 'undefined') return null;
  
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

export function removeUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
}

// ============================================================================
// CLINICA ID
// ============================================================================

export function getClinicaId() {
  const user = getUser();
  return user?.clinica_id || null;
}

// ============================================================================
// AUTH STATE
// ============================================================================

export function isAuthenticated() {
  return getToken() !== null;
}

export function requireAuth() {
  if (!isAuthenticated() && typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

export function clearAuth() {
  removeToken();
  removeUser();
}

export function logout() {
  clearAuth();
  
  // Limpar também o cache
  if (typeof window !== 'undefined') {
    localStorage.clear();
    window.location.href = '/login';
  }
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export function getUserRole() {
  const user = getUser();
  return user?.role || null;
}

export function hasPermission(requiredRole) {
  const role = getUserRole();
  if (!role) return false;
  
  // Hierarquia de permissões: admin > fono > medico > recepcao
  const roleHierarchy = {
    'admin': 4,
    'fono': 3,
    'medico': 2,
    'recepcao': 1,
  };
  
  const userLevel = roleHierarchy[role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

export function isAdmin() {
  return getUserRole() === 'admin';
}

export function isFono() {
  return getUserRole() === 'fono';
}

export function isMedico() {
  return getUserRole() === 'medico';
}

export function isRecepcao() {
  return getUserRole() === 'recepcao';
}
