from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository

tipo_atendimento_bp = Blueprint('tipos_atendimento', __name__)

TIPOS_PADRAO = ['Avaliação', 'Reavaliação', 'Seguimento', 'Terapia', 'Retorno']


@tipo_atendimento_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_tipos():
    """Lista tipos de atendimento da clínica, com fallback para padrões se vazio"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        ativo = request.args.get('ativo')
        filters = {}
        if ativo is not None:
            filters['ativo'] = ativo.lower() == 'true'

        repo = BaseRepository('tipos_atendimento', clinica_id)
        tipos = repo.get_all(filters=filters, order_by='ordem')

        if not tipos:
            tipos = [{'id': None, 'nome': nome, 'ativo': True, 'ordem': i, 'clinica_id': clinica_id}
                     for i, nome in enumerate(TIPOS_PADRAO)]

        return jsonify(tipos), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tipo_atendimento_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_tipo():
    """Cria novo tipo de atendimento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        data = request.get_json()
        if not data.get('nome') or not str(data['nome']).strip():
            return jsonify({'error': 'Campo nome é obrigatório'}), 400

        data['nome'] = str(data['nome']).strip()
        data.setdefault('ativo', True)
        data.setdefault('ordem', 0)

        repo = BaseRepository('tipos_atendimento', clinica_id)
        novo = repo.create(data)

        return jsonify(novo), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tipo_atendimento_bp.route('/<tipo_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def update_tipo(tipo_id):
    """Atualiza tipo de atendimento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        data = request.get_json()
        data.pop('clinica_id', None)

        if 'nome' in data:
            data['nome'] = str(data['nome']).strip()
            if not data['nome']:
                return jsonify({'error': 'Nome não pode ser vazio'}), 400

        repo = BaseRepository('tipos_atendimento', clinica_id)
        tipo = repo.get_by_id(tipo_id)
        if not tipo:
            return jsonify({'error': 'Tipo de atendimento não encontrado'}), 404

        atualizado = repo.update(tipo_id, data)
        return jsonify(atualizado), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tipo_atendimento_bp.route('/<tipo_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def delete_tipo(tipo_id):
    """Remove tipo de atendimento permanentemente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        repo = BaseRepository('tipos_atendimento', clinica_id)
        tipo = repo.get_by_id(tipo_id)
        if not tipo:
            return jsonify({'error': 'Tipo de atendimento não encontrado'}), 404

        repo.delete(tipo_id)
        return jsonify({'message': 'Tipo de atendimento removido com sucesso'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
