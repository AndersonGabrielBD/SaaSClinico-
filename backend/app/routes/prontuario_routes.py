# filepath: backend/app/routes/prontuario_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.utils.audit import log_access
import logging
from flask import send_file
from app.services.pdf_service import PdfService

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
                .select('*, pacientes(id, nome_completo), usuarios:criado_por(nome_completo)') \
                .eq('clinica_id', clinica_id) \
                .in_('paciente_id', paciente_ids) \
                .order('data_criacao', desc=True) \
                .execute()
            
            # Mapear para incluir paciente e nome do criador no formato esperado
            prontuarios_data = []
            for p in (prontuarios.data or []):
                if 'pacientes' in p:
                    p['paciente'] = p.pop('pacientes')
                if p.get('usuarios'):
                    p['criado_por_nome'] = p['usuarios'].get('nome_completo', 'Desconhecido')
                prontuarios_data.append(p)
        else:
            # Admin e recepção veem todos os prontuários
            repo = BaseRepository('prontuarios', clinica_id)
            prontuarios = repo.client.table('prontuarios') \
                .select('*, pacientes(id, nome_completo), usuarios:criado_por(nome_completo)') \
                .eq('clinica_id', clinica_id)
            
            if paciente_id:
                prontuarios = prontuarios.eq('paciente_id', paciente_id)
            
            prontuarios = prontuarios.order('data_criacao', desc=True).execute()
            
            # Mapear para incluir paciente e nome do criador no formato esperado
            prontuarios_data = []
            for p in (prontuarios.data or []):
                if 'pacientes' in p:
                    p['paciente'] = p.pop('pacientes')
                if p.get('usuarios'):
                    p['criado_por_nome'] = p['usuarios'].get('nome_completo', 'Desconhecido')
                prontuarios_data.append(p)
        
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
@log_access('prontuario', 'view', id_param='prontuario_id')
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
        
        # Buscar prontuário com join para trazer o nome do criador
        response = repo.client.table('prontuarios') \
            .select('*, usuarios:criado_por(nome_completo)') \
            .eq('id', prontuario_id) \
            .eq('clinica_id', clinica_id) \
            .single() \
            .execute()
        
        prontuario = response.data if response.data else None
        
        if not prontuario:
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
        # Extrair o nome do criador do objeto nested
        if prontuario.get('usuarios'):
            prontuario['criado_por_nome'] = prontuario['usuarios'].get('nome_completo', 'Desconhecido')
            # Manter o ID original em outro campo se necessário
            # del prontuario['usuarios']
        
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
        user_role = user.get('role')
        user_id = user.get('id')
        
        data = request.get_json()
        
        repo = BaseRepository('prontuarios', clinica_id)
        
        existing = repo.get_by_id(prontuario_id)
        if not existing:
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
        if user_role in ['fono', 'medico', 'profissional']:
            vinculos = repo.client.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', user_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            if existing.get('paciente_id') not in paciente_ids:
                return jsonify({'error': 'Sem permissão para editar este prontuário'}), 403
        
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
        user_role = user.get('role')
        user_id = user.get('id')
        
        repo = BaseRepository('prontuarios', clinica_id)
        
        if user_role in ['fono', 'medico', 'profissional']:
            existing = repo.get_by_id(prontuario_id)
            if not existing:
                return jsonify({'error': 'Prontuário não encontrado'}), 404
            vinculos = repo.client.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', user_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            if existing.get('paciente_id') not in paciente_ids:
                return jsonify({'error': 'Sem permissão para deletar este prontuário'}), 403
        
        repo.delete(prontuario_id)
        
        return jsonify({'message': 'Prontuário deletado'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/export-pdf', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
@log_access('prontuario', 'export', id_param='prontuario_id')
def export_prontuario_pdf(prontuario_id):
    """Exporta prontuário completo em PDF"""
    
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')
        
        logger.info(f"📄 [PDF] Exportando prontuário {prontuario_id}")
        
        # Buscar prontuário com dados relacionados
        repo = BaseRepository('prontuarios', clinica_id)
        prontuario = repo.client.table('prontuarios') \
            .select('*, pacientes(id, nome_completo, cpf, data_nascimento)') \
            .eq('id', prontuario_id) \
            .eq('clinica_id', clinica_id) \
            .single() \
            .execute()
        
        if not prontuario.data:
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
        prontuario_data = prontuario.data
        
        # Verificar permissões (profissionais só acessam seus pacientes)
        if user_role in ['fono', 'medico', 'profissional']:
            vinculos_repo = BaseRepository('pacientes_profissionais', clinica_id)
            vinculos = vinculos_repo.client.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', user_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            
            if prontuario_data.get('paciente_id') not in paciente_ids:
                logger.warning(f"❌ [PDF] Acesso negado")
                return jsonify({'error': 'Sem permissão para acessar este prontuário'}), 403
        
        # Mapear paciente do formato Supabase
        if 'pacientes' in prontuario_data:
            prontuario_data['paciente'] = prontuario_data.pop('pacientes')
        
        # Buscar evoluções do prontuário
        evolucoes_resp = repo.client.table('evolucoes') \
            .select('*') \
            .eq('prontuario_id', prontuario_id) \
            .eq('clinica_id', clinica_id) \
            .order('data_criacao', desc=False) \
            .execute()
        
        prontuario_data['evolucoes'] = evolucoes_resp.data or []
        
        # Gerar PDF
        pdf_service = PdfService()
        pdf_buffer = pdf_service.generate_prontuario_pdf(prontuario_data)
        
        # Nome do arquivo
        paciente_nome = prontuario_data.get('paciente', {}).get('nome_completo', 'paciente')
        paciente_nome = paciente_nome.replace(' ', '_').lower()
        filename = f'prontuario_{paciente_nome}.pdf'
        
        logger.info(f"✅ [PDF] Prontuário exportado")
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"❌ [PDF] Erro ao exportar prontuário: {str(e)}")
        import traceback
        logger.error(f"❌ [PDF] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
