# filepath: backend/app/routes/prontuario_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository

prontuario_bp = Blueprint('prontuarios', __name__)

@prontuario_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_prontuarios():
    """Lista prontuários da clínica"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')
        
        paciente_id = request.args.get('paciente_id')
        
        logger.info(f"📚 [PRONTUARIO] Listando prontuários para clinica_id={clinica_id}, role={user_role}")
        logger.info(f"📚 [PRONTUARIO] Filtro paciente_id={paciente_id}")
        
        # Profissionais (fono, medico) veem apenas prontuários dos seus pacientes vinculados
        if user_role in ['fono', 'medico', 'profissional']:
            logger.info(f"📚 [PRONTUARIO] Filtrando por profissional_id={user_id}")
            
            # Buscar vínculos do profissional
            vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
            vinculos = vinculos_repo.client.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', user_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            
            if not paciente_ids:
                logger.info("📚 [PRONTUARIO] Profissional sem pacientes vinculados")
                return jsonify([]), 200
            
            # Se especificou um paciente_id, verificar se está nos vinculados
            if paciente_id:
                if paciente_id not in paciente_ids:
                    logger.warning(f"📚 [PRONTUARIO] Paciente {paciente_id} não vinculado ao profissional")
                    return jsonify([]), 200
                paciente_ids = [paciente_id]
            
            # Buscar prontuários dos pacientes vinculados
            repo = BaseRepository('prontuarios', clinica_id)
            prontuarios = repo.client.table('prontuarios') \
                .select('*') \
                .eq('clinica_id', clinica_id) \
                .in_('paciente_id', paciente_ids) \
                .order('created_at', desc=True) \
                .execute()
            
            prontuarios_data = prontuarios.data or []
        else:
            # Admin e recepção veem todos os prontuários
            filters = {}
            if paciente_id:
                filters['paciente_id'] = paciente_id
            
            repo = BaseRepository('prontuarios', clinica_id)
            prontuarios_data = repo.get_all(filters=filters, order_by='-created_at')
        
        logger.info(f"✅ [PRONTUARIO] Retornando {len(prontuarios_data)} prontuários")
        return jsonify(prontuarios_data), 200
        
    except Exception as e:
        logger.error(f"❌ [PRONTUARIO] Erro ao listar: {str(e)}")
        import traceback
        logger.error(f"❌ [PRONTUARIO] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_prontuario(prontuario_id):
    """Busca prontuário por ID"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')
        
        repo = BaseRepository('prontuarios', clinica_id)
        prontuario = repo.get_by_id(prontuario_id)
        
        if not prontuario:
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
        # Profissionais só podem acessar prontuários dos seus pacientes vinculados
        if user_role in ['fono', 'medico', 'profissional']:
            logger.info(f"🔍 [PRONTUARIO] Verificando acesso do profissional {user_id} ao prontuário")
            
            # Buscar vínculos do profissional
            vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
            vinculos = vinculos_repo.client.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', user_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            
            # Verificar se o prontuário pertence a um paciente vinculado
            if prontuario.get('paciente_id') not in paciente_ids:
                logger.warning(f"❌ [PRONTUARIO] Acesso negado: prontuário não pertence a paciente vinculado")
                return jsonify({'error': 'Sem permissão para acessar este prontuário'}), 403
        
        return jsonify(prontuario), 200
        
    except Exception as e:
        logger.error(f"❌ [PRONTUARIO] Erro ao buscar: {str(e)}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def create_prontuario():
    """Cria novo prontuário"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user.get('id')
        
        data = request.get_json()
        logger.info(f"📝 [PRONTUARIO] Criando prontuário para clinica_id={clinica_id}")
        logger.info(f"📝 [PRONTUARIO] User ID: {user_id}")
        logger.info(f"📝 [PRONTUARIO] Dados recebidos: {data}")
        
        # Validações
        if not data.get('paciente_id'):
            logger.error("❌ [PRONTUARIO] paciente_id é obrigatório")
            return jsonify({'error': 'paciente_id é obrigatório'}), 400
        
        if not data.get('titulo'):
            logger.error("❌ [PRONTUARIO] titulo é obrigatório")
            return jsonify({'error': 'titulo é obrigatório'}), 400
        
        # Adicionar criado_por se não estiver presente
        if 'criado_por' not in data:
            data['criado_por'] = user_id
            logger.info(f"📝 [PRONTUARIO] Adicionado criado_por: {user_id}")
        
        logger.info(f"📝 [PRONTUARIO] Dados finais para criar: {data}")
        
        repo = BaseRepository('prontuarios', clinica_id)
        prontuario = repo.create(data)
        
        logger.info(f"✅ [PRONTUARIO] Prontuário criado com sucesso: {prontuario.get('id')}")
        return jsonify(prontuario), 201
        
    except Exception as e:
        logger.error(f"❌ [PRONTUARIO] Erro ao criar prontuário: {str(e)}")
        logger.error(f"❌ [PRONTUARIO] Tipo do erro: {type(e).__name__}")
        import traceback
        logger.error(f"❌ [PRONTUARIO] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


@prontuario_bp.route('/<prontuario_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def update_prontuario(prontuario_id):
    """Atualiza prontuário"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        repo = BaseRepository('prontuarios', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(prontuario_id)
        if not existing:
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
        prontuario = repo.update(prontuario_id, data)
        
        return jsonify(prontuario), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def delete_prontuario(prontuario_id):
    """Deleta prontuário"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('prontuarios', clinica_id)
        repo.delete(prontuario_id)
        
        return jsonify({'message': 'Prontuário deletado'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
