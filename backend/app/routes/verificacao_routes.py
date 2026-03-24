# filepath: backend/app/routes/verificacao_routes.py
"""
Rotas para verificações usando RPC Functions otimizadas
"""
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, get_current_user
from app.repositories.base_repository import BaseRepository

verificacao_bp = Blueprint('verificacao', __name__)

@verificacao_bp.route('/cpf', methods=['POST'])
@require_auth
def verificar_cpf():
    """Verifica se CPF já existe usando RPC"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        cpf = data.get('cpf')
        exclude_id = data.get('exclude_id')
        
        if not cpf:
            return jsonify({'error': 'CPF é obrigatório'}), 400
        
        repo = BaseRepository('pacientes', clinica_id)
        exists = repo.check_cpf_exists(cpf, exclude_id)
        
        return jsonify({'exists': exists}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@verificacao_bp.route('/agendamento-conflito', methods=['POST'])
@require_auth
def verificar_conflito_agendamento():
    """Verifica conflito de agendamento usando RPC"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validações
        required = ['profissional_id', 'data_agendamento', 'horario_inicio', 'horario_fim']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
        
        repo = BaseRepository('agendamentos', clinica_id)
        has_conflict = repo.check_agendamento_conflict(
            profissional_id=data['profissional_id'],
            data_agendamento=data['data_agendamento'],
            horario_inicio=data['horario_inicio'],
            horario_fim=data['horario_fim'],
            sala_id=data.get('sala_id'),
            exclude_id=data.get('exclude_id')
        )
        
        return jsonify({'has_conflict': has_conflict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@verificacao_bp.route('/profissionais', methods=['GET'])
@require_auth
def get_profissionais():
    """Busca profissionais (fono/medico/profissional) da clínica"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        ativo = request.args.get('ativo', 'true').lower() == 'true'
        
        from database.supabase_client import get_supabase_client
        client = get_supabase_client()
        query = client.table('usuarios') \
            .select('id, nome_completo, role, especialidade, ativo') \
            .eq('clinica_id', clinica_id) \
            .in_('role', ['fono', 'medico', 'profissional'])
        
        if ativo:
            query = query.eq('ativo', True)
        
        response = query.order('nome_completo').execute()
        
        return jsonify(response.data or []), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
