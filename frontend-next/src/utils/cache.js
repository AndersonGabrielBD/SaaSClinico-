// Cache utilities inspiradas no projeto IA
// Gerenciamento de cache local para dados do dashboard

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// ============================================================================
// ESTATÍSTICAS CACHE
// ============================================================================

const STATS_CACHE_KEY = 'dashboard_stats_cache';

export function getCachedStats() {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(STATS_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Verificar se o cache expirou
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(STATS_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setCachedStats(data) {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Erro ao salvar cache de estatísticas:', e);
  }
}

export function clearStatsCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STATS_CACHE_KEY);
}

// ============================================================================
// AGENDAMENTOS CACHE
// ============================================================================

const AGENDAMENTOS_CACHE_KEY = 'agendamentos_cache';

export function getCachedAgendamentos() {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(AGENDAMENTOS_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Verificar se o cache expirou
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(AGENDAMENTOS_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setCachedAgendamentos(data) {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(AGENDAMENTOS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Erro ao salvar cache de agendamentos:', e);
  }
}

export function clearAgendamentosCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AGENDAMENTOS_CACHE_KEY);
}

// ============================================================================
// PACIENTES CACHE
// ============================================================================

const PACIENTES_CACHE_KEY = 'pacientes_cache';

export function getCachedPacientes() {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(PACIENTES_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Verificar se o cache expirou
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(PACIENTES_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setCachedPacientes(data) {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(PACIENTES_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Erro ao salvar cache de pacientes:', e);
  }
}

export function clearPacientesCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PACIENTES_CACHE_KEY);
}

// ============================================================================
// CLEAR ALL
// ============================================================================

export function clearAllCache() {
  if (typeof window === 'undefined') return;
  
  clearStatsCache();
  clearAgendamentosCache();
  clearPacientesCache();
}

export function invalidateCache(key) {
  if (typeof window === 'undefined') return;
  
  const cacheKeys = {
    'stats': STATS_CACHE_KEY,
    'agendamentos': AGENDAMENTOS_CACHE_KEY,
    'pacientes': PACIENTES_CACHE_KEY,
  };
  
  const cacheKey = cacheKeys[key];
  if (cacheKey) {
    localStorage.removeItem(cacheKey);
  }
}
