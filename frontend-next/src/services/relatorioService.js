// filepath: frontend-next/src/services/relatorioService.js
import { api } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const relatorioService = {
  /**
   * Lista relatórios com filtros opcionais
   */
  async getAll(filters = {}) {
    return await api.get('/relatorios', { params: filters });
  },
  
  /**
   * Busca relatório por ID
   */
  async getById(id) {
    return await api.get(`/relatorios/${id}`);
  },
  
  /**
   * Upload de relatório com arquivo
   */
  async upload(formData) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/relatorios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData // FormData não precisa de Content-Type
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao fazer upload');
    }
    
    return await response.json();
  },
  
  /**
   * Download do arquivo do relatório
   */
  async download(id) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/relatorios/${id}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao fazer download');
    }
    
    return await response.blob();
  },
  
  /**
   * Atualiza relatório existente (apenas título e observações)
   */
  async update(id, data) {
    return await api.put(`/relatorios/${id}`, data);
  },
  
  /**
   * Deleta relatório e arquivo
   */
  async delete(id) {
    return await api.delete(`/relatorios/${id}`);
  }
};
