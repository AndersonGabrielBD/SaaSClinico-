// filepath: frontend-next/src/lib/api.js
// API Base URL - Flask roda na porta 5000
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/** Extrai texto legível de erros JSON (Flask { error }, PostgREST { message, code }). */
function apiErrorMessage(body) {
  if (body == null) return 'Erro na requisição';
  if (typeof body === 'string') return body;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (typeof body.error === 'string' && body.error.trim()) {
    const t = body.error.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed.message === 'string') return parsed.message;
      } catch {
        /* ignore */
      }
    }
    return body.error;
  }
  return 'Erro na requisição';
}

// Helper para fazer requisições
async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/signup');
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

      if (response.status === 401 && typeof window !== 'undefined' && !isAuthEndpoint && !isLoginPage) {
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
      throw new Error(apiErrorMessage(error));
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[API]', endpoint, error.message);
    }
    throw error;
  }
}

// Helper para download de arquivos (blob)
async function downloadFile(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const config = {
    ...options,
    headers: { ...options.headers },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Erro ao baixar arquivo');
    }

    const blob = await response.blob();
    return { data: blob };

  } catch (error) {
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
  // Download de arquivos (retorna blob)
  download: (endpoint, options = {}) => {
    const { params, ...restOptions } = options;
    const queryString = params ? buildQueryString(params) : '';
    return downloadFile(`${endpoint}${queryString}`, { ...restOptions, method: 'GET' });
  },
  // Auth methods
  login: (email, password) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  signup: (data) => {
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

export const cancelarRecorrencia = (data) => {
  return request(`/agendamentos/cancelar-recorrencia`, {
    method: 'PUT',
    body: JSON.stringify(data),
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

export const getEvolucoes = (prontuarioId) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes`, { method: 'GET' });
};

/** Última evolução do usuário logado neste prontuário (pode ser null). */
export const getUltimaEvolucao = (prontuarioId) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes/ultima`, { method: 'GET' });
};

export const createEvolucao = (prontuarioId, data) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateEvolucao = (prontuarioId, evolucaoId, data) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes/${evolucaoId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const finalizarEvolucao = (prontuarioId, evolucaoId) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes/${evolucaoId}/finalizar`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const deleteEvolucao = (prontuarioId, evolucaoId) => {
  return request(`/prontuarios/${prontuarioId}/evolucoes/${evolucaoId}`, {
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
  const params = new URLSearchParams({ ...filters, role: 'fono,medico,profissional' });
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
// TIPOS DE ATENDIMENTO
// ============================================================================

export const getTiposAtendimento = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/tipos-atendimento?${params}`);
};

export const createTipoAtendimento = (data) => {
  return request('/tipos-atendimento', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateTipoAtendimento = (id, data) => {
  return request(`/tipos-atendimento/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteTipoAtendimento = (id) => {
  return request(`/tipos-atendimento/${id}`, {
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

// Returns { data: [], pagination: { page, per_page, total, pages } }
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

export const getModelosEvolucao = () => request('/modelos-evolucao');

export const createModeloEvolucao = (data) =>
  request('/modelos-evolucao', { method: 'POST', body: JSON.stringify(data) });

export const updateModeloEvolucao = (id, data) =>
  request(`/modelos-evolucao/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteModeloEvolucao = (id) =>
  request(`/modelos-evolucao/${id}`, { method: 'DELETE' });

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
  getEvolucoes,
  getUltimaEvolucao,
  createEvolucao,
  updateEvolucao,
  finalizarEvolucao,
  deleteEvolucao,
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
  getTiposAtendimento,
  createTipoAtendimento,
  updateTipoAtendimento,
  deleteTipoAtendimento,
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
  getModelosEvolucao,
  createModeloEvolucao,
  updateModeloEvolucao,
  deleteModeloEvolucao,
};

