import * as api from '@/lib/api'

export const usuarioService = {
  // Listar todos os usuários
  async getAll(filters) {
    return api.getUsuarios(filters)
  },

  // Buscar usuário por ID
  async getById(id) {
    return api.getUsuarioById(id)
  },

  // Listar apenas profissionais (fono/medico/profissional)
  async getProfissionais() {
    try {
      const usuarios = await this.getAll()
      return usuarios.filter(u => 
        u.role === 'fono' || u.role === 'medico' || u.role === 'profissional'
      )
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error)
      return []
    }
  },

  // Criar usuário
  async create(usuario) {
    return api.createUsuario(usuario)
  },

  // Atualizar usuário
  async update(id, usuario) {
    return api.updateUsuario(id, usuario)
  },

  // Desativar usuário
  async deactivate(id) {
    return api.deleteUsuario(id)
  }
}
