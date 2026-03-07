// filepath: frontend-next/src/lib/api.ts
/**
 * Cliente HTTP centralizado para requisições à API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = {
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.mensagem || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async get<T>(endpoint: string): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.mensagem || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.mensagem || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.mensagem || `HTTP ${response.status}`);
    }

    return response.json();
  },
};

/**
 * Tipos de resposta para reset de senha
 */
export interface ResetPasswordRequestResponse {
  sucesso: boolean;
  mensagem: string;
  reset_code?: string;
  user_id?: string;
}

export interface ResetPasswordResponse {
  sucesso: boolean;
  mensagem: string;
}
