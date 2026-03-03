# filepath: backend/app/routes/sala_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository

sala_bp = Blueprint('salas', __name__)

@sala_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'profissional'])
def get_salas():
    """Lista salas da clínica"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Query params
        ativo = request.args.get('ativo')
        
        # Filtros
        filters = {}
        if ativo is not None:
            filters['ativo'] = ativo.lower() == 'true'
        
        repo = BaseRepository('salas', clinica_id)
        salas = repo.get_all(filters=filters, order_by='nome')
        
        return jsonify(salas), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sala_bp.route('/<sala_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'profissional'])
def get_sala(sala_id):
    """Busca sala por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('salas', clinica_id)
        sala = repo.get_by_id(sala_id)
        
        if not sala:
            return jsonify({'error': 'Sala não encontrada'}), 404
        
        return jsonify(sala), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sala_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_sala():
    """Cria nova sala"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validações básicas
        if not data.get('nome'):
            return jsonify({'error': 'Campo nome é obrigatório'}), 400
        
        # Garantir campos padrão
        if 'ativo' not in data:
            data['ativo'] = True
        if 'capacidade' not in data:
            data['capacidade'] = 1
        
        repo = BaseRepository('salas', clinica_id)
        nova_sala = repo.create(data)
        
        return jsonify(nova_sala), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sala_bp.route('/<sala_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def update_sala(sala_id):
    """Atualiza sala existente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Não permitir alterar clinica_id
        data.pop('clinica_id', None)
        
        repo = BaseRepository('salas', clinica_id)
        
        # Verificar se sala existe
        sala = repo.get_by_id(sala_id)
        if not sala:
            return jsonify({'error': 'Sala não encontrada'}), 404
        
        sala_atualizada = repo.update(sala_id, data)
        
        return jsonify(sala_atualizada), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sala_bp.route('/<sala_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin'])
def delete_sala(sala_id):
    """Deleta sala (soft delete)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('salas', clinica_id)
        
        # Verificar se sala existe
        sala = repo.get_by_id(sala_id)
        if not sala:
            return jsonify({'error': 'Sala não encontrada'}), 404
        
        # Soft delete - apenas marca como inativo
        repo.update(sala_id, {'ativo': False})
        
        return jsonify({'message': 'Sala desativada com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
