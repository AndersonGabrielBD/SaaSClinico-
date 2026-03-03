# filepath: backend/app/routes/profissional_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository

profissional_bp = Blueprint('profissional', __name__)


@profissional_bp.route('/me/pacientes', methods=['GET'])
@require_auth
@require_roles(['fono', 'medico', 'profissional'])
def get_my_pacientes():
    """Lista pacientes vinculados ao profissional logado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        profissional_id = user['id']
        
        # Query params
        search = request.args.get('search')
        ativo = request.args.get('ativo')
        
        # Buscar vínculos do profissional
        vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = vinculos_repo.client.table('pacientes_profissionais') \
            .select('paciente_id') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
        
        if not paciente_ids:
            return jsonify([]), 200
        
        # Buscar dados dos pacientes
        pacientes_repo = BaseRepository('pacientes', clinica_id)
        query = pacientes_repo.client.table('pacientes') \
            .select('*') \
            .eq('clinica_id', clinica_id) \
            .in_('id', paciente_ids)
        
        # Filtro de ativo
        if ativo is not None:
            query = query.eq('ativo', ativo.lower() == 'true')
        else:
            query = query.eq('ativo', True)
        
        response = query.order('nome_completo').execute()
        pacientes = response.data or []
        
        # Filtro de busca (nome, CPF, telefone)
        if search:
            search_lower = search.lower()
            pacientes = [
                p for p in pacientes
                if search_lower in p.get('nome_completo', '').lower() or
                   search_lower in p.get('cpf', '').lower() or
                   search_lower in p.get('telefone_principal', '').lower()
            ]
        
        return jsonify(pacientes), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profissional_bp.route('/<profissional_id>/pacientes', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_profissional_pacientes(profissional_id):
    """Lista pacientes vinculados a um profissional específico"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Verifica permissão: só o próprio profissional ou admin/recepção podem acessar
        if user['role'] not in ['admin', 'recepcao'] and user['id'] != profissional_id:
            return jsonify({'error': 'Sem permissão para acessar pacientes de outro profissional'}), 403
        
        # Query params
        search = request.args.get('search')
        ativo = request.args.get('ativo')
        
        # Buscar vínculos do profissional
        vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = vinculos_repo.client.table('pacientes_profissionais') \
            .select('paciente_id') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
        
        if not paciente_ids:
            return jsonify([]), 200
        
        # Buscar dados dos pacientes
        pacientes_repo = BaseRepository('pacientes', clinica_id)
        query = pacientes_repo.client.table('pacientes') \
            .select('*') \
            .eq('clinica_id', clinica_id) \
            .in_('id', paciente_ids)
        
        # Filtro de ativo
        if ativo is not None:
            query = query.eq('ativo', ativo.lower() == 'true')
        else:
            query = query.eq('ativo', True)
        
        response = query.order('nome_completo').execute()
        pacientes = response.data or []
        
        # Filtro de busca
        if search:
            search_lower = search.lower()
            pacientes = [
                p for p in pacientes
                if search_lower in p.get('nome_completo', '').lower() or
                   search_lower in p.get('cpf', '').lower() or
                   search_lower in p.get('telefone_principal', '').lower()
            ]
        
        return jsonify(pacientes), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profissional_bp.route('/me/prontuarios', methods=['GET'])
@require_auth
@require_roles(['fono', 'medico', 'profissional'])
def get_my_prontuarios():
    """Lista prontuários dos pacientes vinculados ao profissional logado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        profissional_id = user['id']
        
        # Query params
        paciente_id = request.args.get('paciente_id')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        # Buscar vínculos do profissional
        vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = vinculos_repo.client.table('pacientes_profissionais') \
            .select('paciente_id') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
        
        if not paciente_ids:
            return jsonify([]), 200
        
        # Se especificou um paciente_id, verificar se está nos vinculados
        if paciente_id:
            if paciente_id not in paciente_ids:
                return jsonify({'error': 'Paciente não vinculado a este profissional'}), 403
            paciente_ids = [paciente_id]
        
        # Buscar prontuários
        prontuarios_repo = BaseRepository('prontuarios', clinica_id)
        query = prontuarios_repo.client.table('prontuarios') \
            .select('*, pacientes(nome_completo)') \
            .eq('clinica_id', clinica_id) \
            .in_('paciente_id', paciente_ids)
        
        # Filtros de data
        if data_inicio:
            query = query.gte('data_prontuario', data_inicio)
        if data_fim:
            query = query.lte('data_prontuario', data_fim)
        
        response = query.order('data_prontuario', desc=True).execute()
        prontuarios = response.data or []
        
        return jsonify(prontuarios), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profissional_bp.route('/<profissional_id>/prontuarios', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_profissional_prontuarios(profissional_id):
    """Lista prontuários dos pacientes vinculados a um profissional específico"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Verifica permissão: só o próprio profissional ou admin/recepção podem acessar
        if user['role'] not in ['admin', 'recepcao'] and user['id'] != profissional_id:
            return jsonify({'error': 'Sem permissão para acessar prontuários de outro profissional'}), 403
        
        # Query params
        paciente_id = request.args.get('paciente_id')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        # Buscar vínculos do profissional
        vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = vinculos_repo.client.table('pacientes_profissionais') \
            .select('paciente_id') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
        
        if not paciente_ids:
            return jsonify([]), 200
        
        # Se especificou um paciente_id, verificar se está nos vinculados
        if paciente_id:
            if paciente_id not in paciente_ids:
                return jsonify({'error': 'Paciente não vinculado a este profissional'}), 403
            paciente_ids = [paciente_id]
        
        # Buscar prontuários
        prontuarios_repo = BaseRepository('prontuarios', clinica_id)
        query = prontuarios_repo.client.table('prontuarios') \
            .select('*, pacientes(nome_completo)') \
            .eq('clinica_id', clinica_id) \
            .in_('paciente_id', paciente_ids)
        
        # Filtros de data
        if data_inicio:
            query = query.gte('data_prontuario', data_inicio)
        if data_fim:
            query = query.lte('data_prontuario', data_fim)
        
        response = query.order('data_prontuario', desc=True).execute()
        prontuarios = response.data or []
        
        return jsonify(prontuarios), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profissional_bp.route('/me/estatisticas', methods=['GET'])
@require_auth
@require_roles(['fono', 'medico', 'profissional'])
def get_my_estatisticas():
    """Estatísticas do profissional logado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        profissional_id = user['id']
        
        # Buscar vínculos ativos
        vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = vinculos_repo.client.table('pacientes_profissionais') \
            .select('paciente_id') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        total_pacientes = len(vinculos.data) if vinculos.data else 0
        
        # Buscar prontuários
        prontuarios_repo = BaseRepository('prontuarios', clinica_id)
        prontuarios = prontuarios_repo.client.table('prontuarios') \
            .select('id', count='exact') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .execute()
        
        total_prontuarios = prontuarios.count or 0
        
        # Buscar agendamentos
        agendamentos_repo = BaseRepository('agendamentos', clinica_id)
        agendamentos = agendamentos_repo.client.table('agendamentos') \
            .select('id, status', count='exact') \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .execute()
        
        total_agendamentos = agendamentos.count or 0
        
        # Contar por status
        agendamentos_data = agendamentos.data or []
        agendamentos_pendentes = len([a for a in agendamentos_data if a.get('status') == 'agendada'])
        agendamentos_concluidos = len([a for a in agendamentos_data if a.get('status') == 'concluida'])
        
        return jsonify({
            'total_pacientes': total_pacientes,
            'total_prontuarios': total_prontuarios,
            'total_agendamentos': total_agendamentos,
            'agendamentos_pendentes': agendamentos_pendentes,
            'agendamentos_concluidos': agendamentos_concluidos
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
