# filepath: backend/app/routes/usuario_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from database.supabase_client import get_supabase_client

usuario_bp = Blueprint('usuarios', __name__)

@usuario_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_usuarios():
    """Lista usuários da clínica"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        logger.info(f"👥 [USUARIOS] Listando usuários para clinica_id={clinica_id}")
        
        # Query params
        ativo = request.args.get('ativo')
        role = request.args.get('role')
        
        logger.info(f"👥 [USUARIOS] Filtros - ativo={ativo}, role={role}")
        
        filters = {}
        if ativo is not None:
            filters['ativo'] = ativo.lower() == 'true'

        if role:
            roles = [r.strip() for r in role.split(',') if r.strip()]
            logger.info(f"👥 [USUARIOS] Filtrando no banco por roles: {roles}")
            if not roles:
                usuarios = []
            else:
                client = get_supabase_client()
                q = client.table('usuarios').select('*').eq('clinica_id', clinica_id)
                if ativo is not None:
                    q = q.eq('ativo', ativo.lower() == 'true')
                q = q.in_('role', roles).order('nome_completo')
                usuarios = q.execute().data or []
            logger.info(f"👥 [USUARIOS] {len(usuarios)} usuários (role no PostgREST)")
        else:
            repo = BaseRepository('usuarios', clinica_id)
            usuarios = repo.get_all(filters=filters, order_by='nome_completo')
            logger.info(f"👥 [USUARIOS] {len(usuarios)} usuários (RPC/listagem geral)")
        
        # Remover senhas dos resultados
        for u in usuarios:
            u.pop('password', None)
            u.pop('senha', None)
        
        logger.info(f"✅ [USUARIOS] Retornando {len(usuarios)} usuários")
        return jsonify(usuarios), 200
        
    except Exception as e:
        logger.error(f"❌ [USUARIOS] Erro: {str(e)}")
        import traceback
        logger.error(f"❌ [USUARIOS] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@usuario_bp.route('/<usuario_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_usuario(usuario_id):
    """Busca usuário por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('usuarios', clinica_id)
        usuario = repo.get_by_id(usuario_id)
        
        if not usuario:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Remover senha
        usuario.pop('password', None)
        usuario.pop('senha', None)
        
        return jsonify(usuario), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@usuario_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin'])
def create_usuario():
    """Cria novo usuário"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validações básicas
        required_fields = ['nome_completo', 'email', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
        
        repo = BaseRepository('usuarios', clinica_id)
        novo_usuario = repo.create(data)
        
        # Remover senha
        novo_usuario.pop('password', None)
        novo_usuario.pop('senha', None)
        
        return jsonify(novo_usuario), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@usuario_bp.route('/<usuario_id>', methods=['PUT'])
@require_auth
@require_roles(['admin'])
def update_usuario(usuario_id):
    """Atualiza usuário existente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Não permitir alterar role ou clinica_id
        data.pop('role', None)
        data.pop('clinica_id', None)
        data.pop('password', None)
        data.pop('senha', None)
        
        repo = BaseRepository('usuarios', clinica_id)
        
        # Verificar se usuário existe
        usuario = repo.get_by_id(usuario_id)
        if not usuario:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        usuario_atualizado = repo.update(usuario_id, data)
        
        # Remover senha
        usuario_atualizado.pop('password', None)
        usuario_atualizado.pop('senha', None)
        
        return jsonify(usuario_atualizado), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@usuario_bp.route('/<usuario_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin'])
def delete_usuario(usuario_id):
    """Deleta usuário (soft delete)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('usuarios', clinica_id)
        
        # Verificar se usuário existe
        usuario = repo.get_by_id(usuario_id)
        if not usuario:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Soft delete - apenas marca como inativo
        repo.update(usuario_id, {'ativo': False})
        
        return jsonify({'message': 'Usuário desativado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
