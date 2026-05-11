# filepath: backend/app/routes/prontuario_routes.py
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.utils.audit import log_access
from app.utils.tenant_query import fetch_row_for_tenant
import logging
from flask import send_file
from app.services.pdf_service import PdfService

logger = logging.getLogger(__name__)

EVOLUCAO_WRITABLE_FIELDS = (
    'conteudo',
    'titulo_resumo',
    'observacoes_confidenciais',
    'observacoes',
    'humor',
    'comportamento',
    'data_sessao',
    'agendamento_id',
)

PRONTUARIO_WRITABLE_FIELDS = (
    'titulo',
    'descricao',
    'diagnostico_preliminar',
    'historico_clinico',
    'alergias',
    'medicacoes',
    'visivel_para_paciente',
    'agendamento_id',
    'profissional_id',
    'queixas',
    'paciente_id',
)


def _pick_prontuario_update_payload(data):
    if not isinstance(data, dict):
        return None, (jsonify({'error': 'JSON inválido'}), 400)
    out = {k: data[k] for k in PRONTUARIO_WRITABLE_FIELDS if k in data}
    if not out:
        return None, (jsonify({'error': 'Nenhum campo permitido para atualização'}), 400)
    return out, None


def _profissional_paciente_ids(client, clinica_id, user_id):
    vinculos = client.table('pacientes_profissionais').select('paciente_id').eq(
        'profissional_id', user_id
    ).eq('clinica_id', clinica_id).eq('ativo', True).execute()
    return [v['paciente_id'] for v in (vinculos.data or [])]


def _assert_prontuario_evolucao_access(prontuario_id):
    """
    Retorna (repo, prontuario, None) ou (None, None, (jsonify_err, status)).
    """
    user = get_current_user()
    clinica_id = user['clinica_id']
    user_role = user.get('role')
    user_id = user.get('id')
    repo = BaseRepository('prontuarios', clinica_id)
    prontuario = fetch_row_for_tenant(
        repo.client, 'prontuarios', prontuario_id, clinica_id, select='*',
    )
    if not prontuario or prontuario.get('deletado_em'):
        return None, None, (jsonify({'error': 'Prontuário não encontrado'}), 404)
    if user_role in ['fono', 'medico', 'profissional']:
        paciente_ids = _profissional_paciente_ids(repo.client, clinica_id, user_id)
        if prontuario.get('paciente_id') not in paciente_ids:
            return None, None, (jsonify({'error': 'Sem permissão para acessar este prontuário'}), 403)
    return repo, prontuario, None


def _map_evolucao_row(row):
    if not row:
        return row
    if row.get('usuarios'):
        row['criado_por_nome'] = row['usuarios'].get('nome_completo', 'Desconhecido')
    return row


def _can_mutate_evolucao(evolucao, user_role, user_id):
    if evolucao.get('imutavel'):
        return False, 'Esta evolução está finalizada e não pode ser alterada'
    if user_role in ['fono', 'medico', 'profissional']:
        if evolucao.get('criado_por') != user_id:
            return False, 'Sem permissão para alterar esta evolução'
    return True, None


def _pick_evolucao_payload(data, require_conteudo=False):
    if not isinstance(data, dict):
        return None, (jsonify({'error': 'JSON inválido'}), 400)
    out = {}
    for k in EVOLUCAO_WRITABLE_FIELDS:
        if k in data:
            out[k] = data[k]
    if require_conteudo:
        conteudo = out.get('conteudo', data.get('conteudo'))
        if not conteudo or not str(conteudo).strip():
            return None, (jsonify({'error': 'conteudo é obrigatório'}), 400)
        out['conteudo'] = str(conteudo).strip()
    return out, None

prontuario_bp = Blueprint('prontuarios', __name__)

@prontuario_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
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
                .is_('deletado_em', 'null') \
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
            # Somente admin vê todos os prontuários da clínica
            repo = BaseRepository('prontuarios', clinica_id)
            prontuarios = repo.client.table('prontuarios') \
                .select('*, pacientes(id, nome_completo), usuarios:criado_por(nome_completo)') \
                .eq('clinica_id', clinica_id) \
                .is_('deletado_em', 'null')
            
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
@require_roles(['admin', 'fono', 'medico', 'profissional'])
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

        prontuario = fetch_row_for_tenant(
            repo.client,
            'prontuarios',
            prontuario_id,
            clinica_id,
            select='*, usuarios:criado_por(nome_completo)',
        )

        if not prontuario or prontuario.get('deletado_em'):
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
        payload, perr = _pick_prontuario_update_payload(data)
        if perr:
            return perr
        
        repo = BaseRepository('prontuarios', clinica_id)
        
        existing = repo.get_by_id(prontuario_id)
        if not existing or existing.get('deletado_em'):
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
        
        prontuario = repo.update(prontuario_id, payload)
        
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
        existing = repo.get_by_id(prontuario_id)
        if not existing or existing.get('deletado_em'):
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
                return jsonify({'error': 'Sem permissão para deletar este prontuário'}), 403

        repo.update(prontuario_id, {'deletado_em': datetime.now(timezone.utc).isoformat()})
        
        return jsonify({'message': 'Prontuário removido'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/export-pdf', methods=['GET'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
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
        prontuario_data = fetch_row_for_tenant(
            repo.client,
            'prontuarios',
            prontuario_id,
            clinica_id,
            select='*, pacientes(id, nome_completo, cpf, data_nascimento)',
        )

        if not prontuario_data or prontuario_data.get('deletado_em'):
            return jsonify({'error': 'Prontuário não encontrado'}), 404
        
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
            .is_('deletado_em', 'null') \
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


# --- Evoluções (aninhadas ao prontuário) ---


@prontuario_bp.route('/<prontuario_id>/evolucoes/ultima', methods=['GET'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def get_ultima_evolucao(prontuario_id):
    """Última evolução do usuário logado neste prontuário (para pré-preenchimento)."""
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user.get('id')

        q = (
            repo.client.table('evolucoes')
            .select('*, usuarios:criado_por(nome_completo)')
            .eq('prontuario_id', prontuario_id)
            .eq('clinica_id', clinica_id)
            .eq('criado_por', user_id)
            .is_('deletado_em', 'null')
            .order('data_criacao', desc=True)
            .limit(1)
            .execute()
        )
        rows = q.data or []
        ev = rows[0] if rows else None
        return jsonify(_map_evolucao_row(ev) if ev else None), 200
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] ultima: {e}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/evolucoes', methods=['GET'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def list_evolucoes(prontuario_id):
    """Lista evoluções: admin vê todas na clínica; profissional só as suas."""
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')

        q = (
            repo.client.table('evolucoes')
            .select('*, usuarios:criado_por(nome_completo)')
            .eq('prontuario_id', prontuario_id)
            .eq('clinica_id', clinica_id)
            .is_('deletado_em', 'null')
        )
        if user_role in ['fono', 'medico', 'profissional']:
            q = q.eq('criado_por', user_id)
        q = q.order('data_criacao', desc=True)
        rows = q.execute().data or []
        for row in rows:
            _map_evolucao_row(row)
        return jsonify(rows), 200
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] list: {e}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/evolucoes', methods=['POST'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def create_evolucao(prontuario_id):
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user.get('id')

        data = request.get_json(silent=True) or {}
        payload, perr = _pick_evolucao_payload(data, require_conteudo=True)
        if perr:
            return perr

        insert_row = {
            'clinica_id': clinica_id,
            'prontuario_id': prontuario_id,
            'criado_por': user_id,
            'imutavel': False,
            **payload,
        }
        if insert_row.get('data_sessao') in (None, ''):
            insert_row['data_sessao'] = datetime.now(timezone.utc).isoformat()

        resp = repo.client.table('evolucoes').insert(insert_row).execute()
        created = resp.data[0] if resp.data else None
        if not created:
            return jsonify({'error': 'Falha ao criar evolução'}), 500
        return jsonify(created), 201
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] create: {e}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/evolucoes/<evolucao_id>/finalizar', methods=['POST'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def finalizar_evolucao(prontuario_id, evolucao_id):
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')

        ev = fetch_row_for_tenant(
            repo.client, 'evolucoes', evolucao_id, clinica_id, select='*',
        )
        if not ev or ev.get('prontuario_id') != prontuario_id or ev.get('deletado_em'):
            return jsonify({'error': 'Evolução não encontrada'}), 404

        ok, msg = _can_mutate_evolucao(ev, user_role, user_id)
        if not ok:
            code = 400 if 'finalizada' in (msg or '') else 403
            return jsonify({'error': msg}), code

        upd = {
            'imutavel': True,
            'data_atualizacao': datetime.now(timezone.utc).isoformat(),
        }
        resp = (
            repo.client.table('evolucoes')
            .update(upd)
            .eq('id', evolucao_id)
            .eq('clinica_id', clinica_id)
            .eq('prontuario_id', prontuario_id)
            .execute()
        )
        row = resp.data[0] if resp.data else None
        return jsonify(row), 200
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] finalizar: {e}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/evolucoes/<evolucao_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def update_evolucao(prontuario_id, evolucao_id):
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')

        ev = fetch_row_for_tenant(
            repo.client, 'evolucoes', evolucao_id, clinica_id, select='*',
        )
        if not ev or ev.get('prontuario_id') != prontuario_id or ev.get('deletado_em'):
            return jsonify({'error': 'Evolução não encontrada'}), 404

        ok, msg = _can_mutate_evolucao(ev, user_role, user_id)
        if not ok:
            code = 400 if 'finalizada' in (msg or '') else 403
            return jsonify({'error': msg}), code

        data = request.get_json(silent=True) or {}
        payload, perr = _pick_evolucao_payload(data, require_conteudo=False)
        if perr:
            return perr
        if not payload:
            return jsonify({'error': 'Nenhum campo para atualizar'}), 400

        if 'conteudo' in payload:
            if not str(payload['conteudo']).strip():
                return jsonify({'error': 'conteudo não pode ser vazio'}), 400
            payload['conteudo'] = str(payload['conteudo']).strip()

        payload['data_atualizacao'] = datetime.now(timezone.utc).isoformat()

        resp = (
            repo.client.table('evolucoes')
            .update(payload)
            .eq('id', evolucao_id)
            .eq('clinica_id', clinica_id)
            .eq('prontuario_id', prontuario_id)
            .execute()
        )
        row = resp.data[0] if resp.data else None
        return jsonify(row), 200
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] update: {e}")
        return jsonify({'error': str(e)}), 500


@prontuario_bp.route('/<prontuario_id>/evolucoes/<evolucao_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'fono', 'medico', 'profissional'])
def delete_evolucao(prontuario_id, evolucao_id):
    try:
        repo, _pr, err = _assert_prontuario_evolucao_access(prontuario_id)
        if err:
            return err
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user.get('id')

        ev = fetch_row_for_tenant(
            repo.client, 'evolucoes', evolucao_id, clinica_id, select='*',
        )
        if not ev or ev.get('prontuario_id') != prontuario_id or ev.get('deletado_em'):
            return jsonify({'error': 'Evolução não encontrada'}), 404

        ok, msg = _can_mutate_evolucao(ev, user_role, user_id)
        if not ok:
            code = 400 if 'finalizada' in (msg or '') else 403
            return jsonify({'error': msg}), code

        repo.client.table('evolucoes').update({
            'deletado_em': datetime.now(timezone.utc).isoformat(),
        }).eq('id', evolucao_id).eq(
            'clinica_id', clinica_id
        ).eq('prontuario_id', prontuario_id).execute()
        return jsonify({'message': 'Evolução removida'}), 200
    except Exception as e:
        logger.error(f"❌ [EVOLUCAO] delete: {e}")
        return jsonify({'error': str(e)}), 500
