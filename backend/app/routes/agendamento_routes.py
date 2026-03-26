# filepath: backend/app/routes/agendamento_routes.py
import logging
import traceback

from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from datetime import datetime
from app.utils.date_utils import today_brazil
from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

agendamento_bp = Blueprint('agendamentos', __name__)

_AGENDAMENTOS_SELECT_EMBEDS = """
    id, data_agendamento, horario_inicio, horario_fim, status, tipo_atendimento, observacoes,
    paciente_id, profissional_id, sala_id, clinica_id, recorrencia_id, recorrencia_tipo,
    pacote_item_id, motivo_cancelamento,
    paciente:pacientes(id, nome_completo, telefone_principal),
    profissional:usuarios!profissional_id(id, nome_completo, especialidade),
    sala:salas(id, nome)
"""


def _unwrap_embed(obj):
    """PostgREST pode devolver objeto ou lista em embeds; normaliza para dict ou None."""
    if obj is None:
        return None
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                return item
        return None
    return obj if isinstance(obj, dict) else None


def _normalize_agendamento_embeds(ag):
    """Garante paciente_nome / profissional_nome e objetos {id, nome_completo} como antes do embed."""
    pac = _unwrap_embed(ag.get('paciente'))
    prof = _unwrap_embed(ag.get('profissional'))

    nome_pac = (pac or {}).get('nome_completo')
    nome_prof = (prof or {}).get('nome_completo')

    ag['paciente_nome'] = nome_pac
    ag['profissional_nome'] = nome_prof

    pid = ag.get('paciente_id')
    ag['paciente'] = (
        {'id': pid, 'nome_completo': nome_pac} if pid and nome_pac else None
    )

    prid = ag.get('profissional_id')
    ag['profissional'] = (
        {'id': prid, 'nome_completo': nome_prof} if prid and nome_prof else None
    )


def _needs_nome_enrichment(agendamentos: list) -> bool:
    """True se algum item tem FK mas ainda sem nome (embed veio null ou vazio)."""
    for ag in agendamentos:
        if ag.get('paciente_id') and not ag.get('paciente_nome'):
            return True
        if ag.get('profissional_id') and not ag.get('profissional_nome'):
            return True
    return False


def _enrich_nomes_batch(client, clinica_id, agendamentos: list) -> None:
    """
    Preenche paciente_nome / profissional_nome quando o embed não retornou dados.
    Mesma lógica do legado, mas só 2 queries extras e sem re-listar agendamentos.
    """
    pac_ids = list({ag['paciente_id'] for ag in agendamentos if ag.get('paciente_id') and not ag.get('paciente_nome')})
    prof_ids = list({ag['profissional_id'] for ag in agendamentos if ag.get('profissional_id') and not ag.get('profissional_nome')})

    pacientes_map = {}
    if pac_ids:
        rows = (
            client.table('pacientes')
            .select('id, nome_completo')
            .eq('clinica_id', clinica_id)
            .in_('id', pac_ids)
            .execute()
            .data
            or []
        )
        pacientes_map = {r['id']: r.get('nome_completo') for r in rows}

    profissionais_map = {}
    if prof_ids:
        rows = (
            client.table('usuarios')
            .select('id, nome_completo')
            .eq('clinica_id', clinica_id)
            .in_('id', prof_ids)
            .execute()
            .data
            or []
        )
        profissionais_map = {r['id']: r.get('nome_completo') for r in rows}

    for ag in agendamentos:
        if not ag.get('paciente_nome') and ag.get('paciente_id'):
            nome = pacientes_map.get(ag['paciente_id'])
            ag['paciente_nome'] = nome
            ag['paciente'] = {'id': ag['paciente_id'], 'nome_completo': nome} if nome else None
        if not ag.get('profissional_nome') and ag.get('profissional_id'):
            nome = profissionais_map.get(ag['profissional_id'])
            ag['profissional_nome'] = nome
            ag['profissional'] = {'id': ag['profissional_id'], 'nome_completo': nome} if nome else None


def _list_agendamentos_legacy(client, user, clinica_id, paciente_id, profissional_id, status,
                              data_agendamento, data_inicio, data_fim):
    """3 round-trips ao PostgREST (fallback se embed falhar)."""
    query = client.table('agendamentos')\
        .select('id, data_agendamento, horario_inicio, horario_fim, status, tipo_atendimento, observacoes, paciente_id, profissional_id, sala_id, clinica_id, recorrencia_id, recorrencia_tipo, pacote_item_id, motivo_cancelamento')\
        .eq('clinica_id', clinica_id)\
        .order('data_agendamento', desc=False)\
        .order('horario_inicio', desc=False)

    if user.get('role') in ['fono', 'medico', 'profissional']:
        query = query.eq('profissional_id', user['user_id'])
    else:
        if paciente_id:
            query = query.eq('paciente_id', paciente_id)
        if profissional_id:
            query = query.eq('profissional_id', profissional_id)
    if status:
        query = query.eq('status', status)
    if data_agendamento:
        query = query.eq('data_agendamento', data_agendamento)
    elif data_inicio or data_fim:
        if data_inicio:
            query = query.gte('data_agendamento', data_inicio)
        if data_fim:
            query = query.lte('data_agendamento', data_fim)

    agendamentos = query.execute().data or []

    pac_ids = list({ag['paciente_id'] for ag in agendamentos if ag.get('paciente_id')})
    prof_ids = list({ag['profissional_id'] for ag in agendamentos if ag.get('profissional_id')})

    pacientes_map = {}
    if pac_ids:
        rows = client.table('pacientes').select('id, nome_completo').eq('clinica_id', clinica_id).in_('id', pac_ids).execute().data or []
        pacientes_map = {r['id']: r['nome_completo'] for r in rows}

    profissionais_map = {}
    if prof_ids:
        rows = client.table('usuarios').select('id, nome_completo').eq('clinica_id', clinica_id).in_('id', prof_ids).execute().data or []
        profissionais_map = {r['id']: r['nome_completo'] for r in rows}

    for ag in agendamentos:
        nome_pac = pacientes_map.get(ag.get('paciente_id'))
        ag['paciente_nome'] = nome_pac
        ag['paciente'] = {'id': ag['paciente_id'], 'nome_completo': nome_pac} if nome_pac else None

        nome_prof = profissionais_map.get(ag.get('profissional_id'))
        ag['profissional_nome'] = nome_prof
        ag['profissional'] = {'id': ag['profissional_id'], 'nome_completo': nome_prof} if nome_prof else None

    return agendamentos


@agendamento_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_agendamentos():
    """Lista agendamentos da clínica com filtros empurrados ao banco (sem carregamento total)."""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        paciente_id = request.args.get('paciente_id')
        profissional_id = request.args.get('profissional_id')
        status = request.args.get('status')
        data_agendamento = request.args.get('data_agendamento')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')

        client = get_supabase_client()

        query = (
            client.table('agendamentos')
            .select(_AGENDAMENTOS_SELECT_EMBEDS)
            .eq('clinica_id', clinica_id)
            .order('data_agendamento', desc=False)
            .order('horario_inicio', desc=False)
        )

        if user.get('role') in ['fono', 'medico', 'profissional']:
            query = query.eq('profissional_id', user['user_id'])
        else:
            if paciente_id:
                query = query.eq('paciente_id', paciente_id)
            if profissional_id:
                query = query.eq('profissional_id', profissional_id)
        if status:
            query = query.eq('status', status)
        if data_agendamento:
            query = query.eq('data_agendamento', data_agendamento)
        elif data_inicio or data_fim:
            if data_inicio:
                query = query.gte('data_agendamento', data_inicio)
            if data_fim:
                query = query.lte('data_agendamento', data_fim)

        try:
            agendamentos = query.execute().data or []
            for ag in agendamentos:
                _normalize_agendamento_embeds(ag)
            if agendamentos and _needs_nome_enrichment(agendamentos):
                _enrich_nomes_batch(client, clinica_id, agendamentos)
        except Exception as embed_err:
            logger.warning(
                "[AGENDAMENTO] Embed falhou, usando listagem legada: %s",
                embed_err,
            )
            logger.warning(f"[AGENDAMENTO] Falha ao normalizar embeds: {embed_err}")
            agendamentos = _list_agendamentos_legacy(
                client, user, clinica_id, paciente_id, profissional_id, status,
                data_agendamento, data_inicio, data_fim,
            )

        return jsonify(agendamentos), 200

    except Exception as e:
        logger.error(f"[AGENDAMENTO] Erro ao listar: {traceback.format_exc()}")
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

        role = user.get('role')
        if role in ['fono', 'medico', 'profissional']:
            if agendamento.get('profissional_id') != user['user_id']:
                return jsonify({'error': 'Não autorizado'}), 403

        return jsonify(agendamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@agendamento_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
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
        
        # Validar data apenas se estiver sendo alterada (não bloquear updates de status)
        if data.get('data_agendamento') and len(data) > 1:
            data_agendamento = data.get('data_agendamento')
            hoje = today_brazil().isoformat()
            if data_agendamento < hoje:
                return jsonify({'error': 'Não é possível reagendar para datas passadas'}), 400
        
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


@agendamento_bp.route('/cancelar-recorrencia', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def cancelar_recorrencia():
    """Cancela em lote todos os agendamentos de uma série recorrente.
    
    Body: {
      recorrencia_id: str,
      from_date: str (opcional — cancela apenas os com data >= from_date),
      motivo: str (opcional)
    }
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        data = request.get_json()
        recorrencia_id = data.get('recorrencia_id')
        from_date = data.get('from_date')
        motivo = data.get('motivo')

        if not recorrencia_id:
            return jsonify({'error': 'recorrencia_id é obrigatório'}), 400

        client = get_supabase_client()

        query = client.table('agendamentos')\
            .select('id')\
            .eq('clinica_id', clinica_id)\
            .eq('recorrencia_id', recorrencia_id)\
            .not_.in_('status', ['cancelada', 'concluida'])

        if from_date:
            query = query.gte('data_agendamento', from_date)

        rows = query.execute().data or []
        ids = [r['id'] for r in rows]

        if not ids:
            return jsonify({'message': 'Nenhum agendamento encontrado para cancelar', 'cancelados': 0}), 200

        update_payload = {'status': 'cancelada'}
        if motivo:
            update_payload['motivo_cancelamento'] = motivo

        client.table('agendamentos')\
            .update(update_payload)\
            .in_('id', ids)\
            .eq('clinica_id', clinica_id)\
            .execute()

        return jsonify({'message': f'{len(ids)} agendamento(s) cancelado(s)', 'cancelados': len(ids)}), 200

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'[RECORRENCIA] Erro ao cancelar: {e}')
        return jsonify({'error': str(e)}), 500


@agendamento_bp.route('/export-pdf', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def export_agenda_pdf():
    """Exporta agenda filtrada em PDF"""
    import logging
    from flask import send_file
    from app.services.pdf_service import PdfService
    
    logger = logging.getLogger(__name__)
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Query params (mesmos filtros do GET de agendamentos)
        paciente_id = request.args.get('paciente_id')
        profissional_id = request.args.get('profissional_id')
        status = request.args.get('status')
        data_agendamento = request.args.get('data_agendamento')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        logger.info(f"📄 [PDF] Exportando agenda para clinica_id={clinica_id}")
        
        # Profissionais só veem sua própria agenda (mesmo filtro do GET /agendamentos)
        if user.get('role') in ['fono', 'medico', 'profissional']:
            profissional_id = user['user_id']

        # Buscar agendamentos com os filtros
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
        
        # Filtro de data manual
        if not data_agendamento:
            if data_inicio:
                agendamentos = [a for a in agendamentos if a.get('data_agendamento', '') >= data_inicio]
            if data_fim:
                agendamentos = [a for a in agendamentos if a.get('data_agendamento', '') <= data_fim]
        
        # Enriquecer com nomes
        client = get_supabase_client()
        if agendamentos:
            paciente_ids = list({a.get('paciente_id') for a in agendamentos if a.get('paciente_id')})
            profissional_ids = list({a.get('profissional_id') for a in agendamentos if a.get('profissional_id')})
            
            pacientes_map = {}
            profissionais_map = {}
            
            if paciente_ids:
                try:
                    pacientes_resp = client.table('pacientes') \
                        .select('id, nome_completo') \
                        .eq('clinica_id', clinica_id) \
                        .in_('id', paciente_ids) \
                        .execute()
                    for p in (pacientes_resp.data or []):
                        pacientes_map[p['id']] = p.get('nome_completo')
                except Exception as e:
                    logger.warning(f"⚠️ Falha ao carregar nomes de pacientes: {str(e)}")
            
            if profissional_ids:
                try:
                    profissionais_resp = client.table('usuarios') \
                        .select('id, nome_completo') \
                        .eq('clinica_id', clinica_id) \
                        .in_('id', profissional_ids) \
                        .execute()
                    for p in (profissionais_resp.data or []):
                        profissionais_map[p['id']] = p.get('nome_completo')
                except Exception as e:
                    logger.warning(f"⚠️ Falha ao carregar nomes de profissionais: {str(e)}")
            
            for ag in agendamentos:
                if not ag.get('paciente_nome'):
                    ag['paciente_nome'] = pacientes_map.get(ag.get('paciente_id'), 'N/A')
                if not ag.get('profissional_nome'):
                    ag['profissional_nome'] = profissionais_map.get(ag.get('profissional_id'), 'N/A')
        
        # Gerar PDF
        pdf_service = PdfService()
        filtros_info = {
            'data_agendamento': data_agendamento,
            'data_inicio': data_inicio,
            'data_fim': data_fim
        }
        pdf_buffer = pdf_service.generate_agenda_pdf(agendamentos, filtros_info)
        
        # Gerar nome do arquivo
        filename = 'agenda'
        if data_agendamento:
            filename += f'_{data_agendamento}'
        elif data_inicio and data_fim:
            filename += f'_{data_inicio}_a_{data_fim}'
        filename += '.pdf'
        
        logger.info(f"✅ [PDF] Agenda exportada: {len(agendamentos)} agendamentos")
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"❌ [PDF] Erro ao exportar agenda: {str(e)}")
        import traceback
        logger.error(f"❌ [PDF] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
