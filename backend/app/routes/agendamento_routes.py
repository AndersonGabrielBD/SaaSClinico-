# filepath: backend/app/routes/agendamento_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from datetime import datetime
from app.utils.date_utils import today_brazil

agendamento_bp = Blueprint('agendamentos', __name__)

@agendamento_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_agendamentos():
    """Lista agendamentos da clínica"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Query params
        paciente_id = request.args.get('paciente_id')
        profissional_id = request.args.get('profissional_id')
        status = request.args.get('status')
        data_agendamento = request.args.get('data_agendamento')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        logger.info(f"📅 [AGENDAMENTO] Listando agendamentos para clinica_id={clinica_id}")
        logger.info(f"📅 [AGENDAMENTO] Filtros: paciente={paciente_id}, prof={profissional_id}, status={status}, data={data_agendamento}")
        
        # Filtros
        filters = {}
        if paciente_id:
            filters['paciente_id'] = paciente_id
        if profissional_id:
            filters['profissional_id'] = profissional_id
        if status:
            filters['status'] = status
        if data_agendamento:
            filters['data_agendamento'] = data_agendamento
        
        repo = BaseRepository('agendamentos', clinica_id)
        agendamentos = repo.get_all(filters=filters, order_by='data_agendamento')
        
        logger.info(f"📅 [AGENDAMENTO] Retornados {len(agendamentos)} agendamentos do banco")
        
        # Filtro de data manual (se não usou data_agendamento exata)
        if not data_agendamento:
            if data_inicio:
                agendamentos = [a for a in agendamentos if a.get('data_agendamento', '') >= data_inicio]
                logger.info(f"📅 [AGENDAMENTO] Após filtro data_inicio: {len(agendamentos)} agendamentos")
            if data_fim:
                agendamentos = [a for a in agendamentos if a.get('data_agendamento', '') <= data_fim]
                logger.info(f"📅 [AGENDAMENTO] Após filtro data_fim: {len(agendamentos)} agendamentos")
        
        logger.info(f"✅ [AGENDAMENTO] Retornando {len(agendamentos)} agendamentos")
        return jsonify(agendamentos), 200
        
    except Exception as e:
        logger.error(f"❌ [AGENDAMENTO] Erro ao listar: {str(e)}")
        import traceback
        logger.error(f"❌ [AGENDAMENTO] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@agendamento_bp.route('/<agendamento_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_agendamento(agendamento_id):
    """Busca agendamento por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('agendamentos', clinica_id)
        agendamento = repo.get_by_id(agendamento_id)
        
        if not agendamento:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        return jsonify(agendamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@agendamento_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def create_agendamento():
    """Cria novo agendamento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validações de campos obrigatórios
        required_fields = ['paciente_id', 'profissional_id', 'data_agendamento', 'horario_inicio', 'horario_fim']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo obrigatório "{field}" não foi preenchido'}), 400
        
        # Validar data (não pode ser passada)
        data_agendamento = data.get('data_agendamento')
        hoje = today_brazil().isoformat()
        if data_agendamento < hoje:
            return jsonify({'error': 'Não é possível agendar em datas passadas'}), 400
        
        # Set padrões
        data['status'] = data.get('status', 'agendada')
        
        repo = BaseRepository('agendamentos', clinica_id)
        agendamento = repo.create(data)
        
        return jsonify(agendamento), 201
        
    except Exception as e:
        error_str = str(e)
        
        # Interpretar erros de constraint
        if 'data_futura' in error_str or '23514' in error_str:
            return jsonify({'error': 'Não é possível agendar em datas passadas'}), 400
        elif 'unique constraint' in error_str.lower():
            return jsonify({'error': 'Este agendamento já existe'}), 400
        elif 'foreign key' in error_str.lower():
            return jsonify({'error': 'Paciente ou profissional inválido'}), 400
        
        return jsonify({'error': error_str}), 500


@agendamento_bp.route('/<agendamento_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def update_agendamento(agendamento_id):
    """Atualiza agendamento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validar data se ela foi informada (não pode ser passada)
        if data.get('data_agendamento'):
            data_agendamento = data.get('data_agendamento')
            hoje = today_brazil().isoformat()
            if data_agendamento < hoje:
                return jsonify({'error': 'Não é possível agendar em datas passadas'}), 400
        
        repo = BaseRepository('agendamentos', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(agendamento_id)
        if not existing:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        agendamento = repo.update(agendamento_id, data)
        
        return jsonify(agendamento), 200
        
    except Exception as e:
        error_str = str(e)
        
        # Interpretar erros de constraint
        if 'data_futura' in error_str or '23514' in error_str:
            return jsonify({'error': 'Não é possível agendar em datas passadas'}), 400
        elif 'unique constraint' in error_str.lower():
            return jsonify({'error': 'Este agendamento já existe'}), 400
        elif 'foreign key' in error_str.lower():
            return jsonify({'error': 'Paciente ou profissional inválido'}), 400
        
        return jsonify({'error': error_str}), 500


@agendamento_bp.route('/<agendamento_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def delete_agendamento(agendamento_id):
    """Cancela agendamento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('agendamentos', clinica_id)
        repo.update(agendamento_id, {'status': 'cancelada'})
        
        return jsonify({'message': 'Agendamento cancelado'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
