// filepath: frontend-next/src/lib/api.js
// API Base URL - Flask roda na porta 5000
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper para fazer requisições
async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  console.log('🌐 [API REQUEST] ====================');
  console.log('🌐 [API REQUEST] Endpoint:', endpoint);
  console.log('🌐 [API REQUEST] Method:', options.method || 'GET');
  console.log('🌐 [API REQUEST] Token presente:', !!token);
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (options.body) {
    console.log('🌐 [API REQUEST] Body:', options.body);
  }
  
  console.log('🌐 [API REQUEST] URL completa:', `${API_URL}${endpoint}`);
  console.log('🌐 [API REQUEST] Headers:', config.headers);
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    console.log('🌐 [API RESPONSE] Status:', response.status, response.statusText);
    
    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        console.warn('⚠️ [API] 401 Unauthorized - Redirecionando para login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      
      const errorText = await response.text();
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'Erro desconhecido' };
      }
      
      const errorMessage = error.error || error.message || 'Erro na requisição';
      console.error('❌ [API ERROR]', response.status, errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('✅ [API RESPONSE] Success');
    console.log('🌐 [API REQUEST] ====================');
    return data;
    
  } catch (error) {
    console.error('❌ [API ERROR]', error.message);
    console.log('🌐 [API REQUEST] ====================');
    throw error;
  }
}

// Helper para construir query string
function buildQueryString(params) {
  if (!params || Object.keys(params).length === 0) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      query.append(key, value);
    }
  });
  return `?${query.toString()}`;
}

// Helper object para facilitar uso em services
export const api = {
  get: (endpoint, options = {}) => {
    const { params, ...restOptions } = options;
    const queryString = params ? buildQueryString(params) : '';
    return request(`${endpoint}${queryString}`, { ...restOptions, method: 'GET' });
  },
  post: (endpoint, data, options = {}) => {
    return request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  put: (endpoint, data, options = {}) => {
    return request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: (endpoint, options = {}) => {
    return request(endpoint, { ...options, method: 'DELETE' });
  },
};

// ============================================================================
// AUTH
// ============================================================================

export const login = (email, password) => {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const signup = (data) => {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getCurrentUser = () => {
  return request('/auth/me');
};

// ============================================================================
// PACIENTES
// ============================================================================

export const getPacientes = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/pacientes?${params}`);
};

export const getPacienteById = (id) => {
  return request(`/pacientes/${id}`);
};

export const createPaciente = (data) => {
  return request('/pacientes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updatePaciente = (id, data) => {
  return request(`/pacientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deletePaciente = (id) => {
  return request(`/pacientes/${id}`, {
    method: 'DELETE',
  });
};

// Relacionamento Paciente-Profissional
export const getPacienteProfissionais = (pacienteId) => {
  return request(`/pacientes/${pacienteId}/profissionais`);
};

export const addProfissionalToPaciente = (pacienteId, profissionalIds) => {
  return request(`/pacientes/${pacienteId}/profissionais`, {
    method: 'POST',
    body: JSON.stringify({ profissional_ids: profissionalIds }),
  });
};

export const removeProfissionalFromPaciente = (pacienteId, profissionalId) => {
  return request(`/pacientes/${pacienteId}/profissionais/${profissionalId}`, {
    method: 'DELETE',
  });
};

export const syncPacienteProfissionais = (pacienteId, profissionalIds) => {
  return request(`/pacientes/${pacienteId}/profissionais/sync`, {
    method: 'PUT',
    body: JSON.stringify({ profissional_ids: profissionalIds }),
  });
};

// ============================================================================
// AGENDAMENTOS
// ============================================================================

export const getAgendamentos = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/agendamentos?${params}`);
};

export const getAgendamentoById = (id) => {
  return request(`/agendamentos/${id}`);
};

export const createAgendamento = (data) => {
  return request('/agendamentos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateAgendamento = (id, data) => {
  return request(`/agendamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteAgendamento = (id) => {
  return request(`/agendamentos/${id}`, {
    method: 'DELETE',
  });
};

// ============================================================================
// PRONTUÁRIOS
// ============================================================================

export const getProntuarios = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/prontuarios?${params}`);
};

export const getProntuarioById = (id) => {
  return request(`/prontuarios/${id}`);
};

export const createProntuario = (data) => {
  console.log('🌐 [API] createProntuario - Dados:', data);
  console.log('🌐 [API] createProntuario - URL:', `${API_URL}/prontuarios`);
  return request('/prontuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateProntuario = (id, data) => {
  return request(`/prontuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteProntuario = (id) => {
  return request(`/prontuarios/${id}`, {
    method: 'DELETE',
  });
};

// ============================================================================
// USUÁRIOS / PROFISSIONAIS
// ============================================================================

export const getUsuarios = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/usuarios?${params}`);
};

export const getUsuarioById = (id) => {
  return request(`/usuarios/${id}`);
};

export const createUsuario = (data) => {
  return request('/usuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateUsuario = (id, data) => {
  return request(`/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteUsuario = (id) => {
  return request(`/usuarios/${id}`, {
    method: 'DELETE',
  });
};

export const getProfissionais = (filters = {}) => {
  const params = new URLSearchParams({ ...filters, role: 'fono,medico' });
  return request(`/usuarios?${params}`);
};

// ============================================================================
// SALAS
// ============================================================================

export const getSalas = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/salas?${params}`);
};

export const getSalaById = (id) => {
  return request(`/salas/${id}`);
};

export const createSala = (data) => {
  return request('/salas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateSala = (id, data) => {
  return request(`/salas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteSala = (id) => {
  return request(`/salas/${id}`, {
    method: 'DELETE',
  });
};

// ============================================================================
// DASHBOARD
// ============================================================================

export const getDashboardStats = () => {
  return request('/dashboard/stats');
};

export const getRecentActivity = () => {
  return request('/dashboard/recent');
};

// Aliases para compatibilidade
export const getEstatisticas = getDashboardStats;
export const getProximosAgendamentos = (limite = 10) => getRecentActivity();

// ============================================================================
// FINANCEIRO
// ============================================================================

export const getLancamentos = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/financeiro/lancamentos${query ? `?${query}` : ''}`);
};

export const getLancamentoById = (id) => {
  return request(`/financeiro/lancamentos/${id}`);
};

export const createLancamento = (data) => {
  return request('/financeiro/lancamentos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateLancamento = (id, data) => {
  return request(`/financeiro/lancamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteLancamento = (id) => {
  return request(`/financeiro/lancamentos/${id}`, {
    method: 'DELETE',
  });
};

export const getResumoFinanceiro = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/financeiro/relatorio/resumo${query ? `?${query}` : ''}`);
};

export const getPendencias = () => {
  return request('/financeiro/pendencias');
};

// ============================================================================
// PROFISSIONAIS
// ============================================================================

export const getMyPacientes = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/profissionais/me/pacientes?${params}`);
};

export const getProfissionalPacientes = (profissionalId, filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/profissionais/${profissionalId}/pacientes?${params}`);
};

export const getMyProntuarios = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/profissionais/me/prontuarios?${params}`);
};

export const getProfissionalProntuarios = (profissionalId, filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/profissionais/${profissionalId}/prontuarios?${params}`);
};

export const getMyEstatisticas = () => {
  return request('/profissionais/me/estatisticas');
};

// Export default para compatibilidade
export default {
  login,
  signup,
  getCurrentUser,
  getPacientes,
  getPacienteById,
  createPaciente,
  updatePaciente,
  deletePaciente,
  getPacienteProfissionais,
  addProfissionalToPaciente,
  removeProfissionalFromPaciente,
  syncPacienteProfissionais,
  getAgendamentos,
  getAgendamentoById,
  createAgendamento,
  updateAgendamento,
  deleteAgendamento,
  getProntuarios,
  getProntuarioById,
  createProntuario,
  updateProntuario,
  deleteProntuario,
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getProfissionais,
  getSalas,
  getSalaById,
  createSala,
  updateSala,
  deleteSala,
  getDashboardStats,
  getRecentActivity,
  getEstatisticas,
  getProximosAgendamentos,
  getLancamentos,
  getLancamentoById,
  createLancamento,
  updateLancamento,
  deleteLancamento,
  getResumoFinanceiro,
  getPendencias,
  getMyPacientes,
  getProfissionalPacientes,
  getMyProntuarios,
  getProfissionalProntuarios,
  getMyEstatisticas,
};

