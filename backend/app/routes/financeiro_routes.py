# filepath: backend/app/routes/financeiro_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.services.mensalidade_service import MensalidadeService
from datetime import datetime, timedelta
from app.utils.date_utils import today_brazil

financeiro_bp = Blueprint('financeiro', __name__)


@financeiro_bp.route('/diagnostico', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def diagnostico_financeiro():
    """Diagnóstico: conta registros nas tabelas financeiras sem filtros para detectar problemas de dados"""
    import logging
    logger = logging.getLogger(__name__)
    from database.supabase_client import get_supabase_client
    from app.utils.date_utils import start_of_month_brazil

    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        client = get_supabase_client()
        mes_atual = start_of_month_brazil().isoformat()

        # Conta mensalidades sem filtro de ativo
        m_total = client.table('mensalidades_pacientes').select('id', count='exact').eq('clinica_id', clinica_id).execute()
        m_ativas = client.table('mensalidades_pacientes').select('id', count='exact').eq('clinica_id', clinica_id).eq('ativo', True).execute()

        # Conta pagamentos sem filtro de mes
        p_total = client.table('pagamentos_mensalidades').select('id', count='exact').eq('clinica_id', clinica_id).execute()
        p_mes = client.table('pagamentos_mensalidades').select('id', count='exact').eq('clinica_id', clinica_id).eq('mes_referencia', mes_atual).execute()

        # Amostra de mes_referencia existentes (distinct via Python)
        p_sample = client.table('pagamentos_mensalidades').select('mes_referencia').eq('clinica_id', clinica_id).limit(20).execute()
        meses_existentes = list({p['mes_referencia'] for p in (p_sample.data or [])})

        result = {
            'clinica_id': clinica_id,
            'mes_atual_filtrado': mes_atual,
            'mensalidades': {
                'total': m_total.count or 0,
                'ativas': m_ativas.count or 0,
            },
            'pagamentos': {
                'total': p_total.count or 0,
                'mes_atual': p_mes.count or 0,
                'meses_existentes_no_banco': sorted(meses_existentes),
            }
        }

        logger.info(f"🔍 [DIAG] {result}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"❌ [DIAG] {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


_PAGE_SIZE_DEFAULT = 100
_PAGE_SIZE_MAX = 500


@financeiro_bp.route('/lancamentos', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_lancamentos():
    """Lista lançamentos financeiros com filtros no banco e paginação."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        status = request.args.get('status')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        paciente_id = request.args.get('paciente_id')

        try:
            page = max(1, int(request.args.get('page', 1)))
            per_page = min(int(request.args.get('per_page', _PAGE_SIZE_DEFAULT)), _PAGE_SIZE_MAX)
        except (ValueError, TypeError):
            page, per_page = 1, _PAGE_SIZE_DEFAULT

        offset = (page - 1) * per_page

        from database.supabase_client import get_supabase_client
        client = get_supabase_client()

        query = (
            client.table('lancamentos_financeiros')
            .select('*', count='exact')
            .eq('clinica_id', clinica_id)
            .order('data_criacao', desc=True)
            .range(offset, offset + per_page - 1)
        )

        if status:
            query = query.eq('status', status)
        if paciente_id:
            query = query.eq('paciente_id', paciente_id)
        if data_inicio:
            query = query.gte('data_criacao', data_inicio)
        if data_fim:
            query = query.lt('data_criacao', data_fim + 'T23:59:59')

        result = query.execute()
        total = result.count or 0

        return jsonify({
            'data': result.data or [],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': max(1, -(-total // per_page)),
            },
        }), 200

    except Exception as e:
        logger.error(f"[FINANCEIRO] Erro ao buscar lançamentos: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_lancamento(lancamento_id):
    """Busca lançamento por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        lancamento = repo.get_by_id(lancamento_id)
        
        if not lancamento:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        return jsonify(lancamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_lancamento():
    """Cria novo lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        
        data = request.get_json()
        
        # Validações básicas
        if not data.get('descricao'):
            return jsonify({'error': 'Campo descricao é obrigatório'}), 400
        if not data.get('valor'):
            return jsonify({'error': 'Campo valor é obrigatório'}), 400
        
        # Limpar campos de data vazios
        if data.get('data_vencimento') == '':
            data['data_vencimento'] = None
        if data.get('data_pagamento') == '':
            data['data_pagamento'] = None
        
        # Limpar campos string vazios opcionais
        if data.get('metodo_pagamento') == '':
            data['metodo_pagamento'] = None
        if data.get('observacoes') == '':
            data['observacoes'] = None
        if data.get('paciente_id') == '':
            data['paciente_id'] = None
        
        # Set padrões
        data['status'] = data.get('status', 'pendente')
        data['tipo_valor'] = data.get('tipo_valor', 'credito')
        data['criado_por'] = user_id
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        lancamento = repo.create(data)
        
        return jsonify(lancamento), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def update_lancamento(lancamento_id):
    """Atualiza lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(lancamento_id)
        if not existing:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        # Limpar campos de data vazios
        if data.get('data_vencimento') == '':
            data['data_vencimento'] = None
        if data.get('data_pagamento') == '':
            data['data_pagamento'] = None
        
        # Limpar campos string vazios opcionais
        if data.get('metodo_pagamento') == '':
            data['metodo_pagamento'] = None
        if data.get('observacoes') == '':
            data['observacoes'] = None
        if data.get('paciente_id') == '':
            data['paciente_id'] = None
        
        # Se estiver marcando como pago, adiciona data de pagamento
        if data.get('status') == 'pago' and not data.get('data_pagamento'):
            data['data_pagamento'] = datetime.now().isoformat()
        
        lancamento = repo.update(lancamento_id, data)
        
        return jsonify(lancamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def delete_lancamento(lancamento_id):
    """Deleta lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(lancamento_id)
        if not existing:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        repo.delete(lancamento_id)
        
        return jsonify({'message': 'Lançamento deletado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/relatorio/resumo', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_resumo_financeiro():
    """Retorna resumo financeiro via RPC — todo SUM/COUNT/GROUP BY feito no banco."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')

        if not data_inicio:
            data_inicio = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        if not data_fim:
            proximo_mes = datetime.now().replace(day=28) + timedelta(days=4)
            data_fim = (proximo_mes - timedelta(days=proximo_mes.day)).strftime('%Y-%m-%d')

        from database.supabase_client import get_supabase_client
        client = get_supabase_client()

        # Uma única chamada RPC faz todos os SUM/COUNT/GROUP BY no banco
        result = client.rpc('get_resumo_financeiro', {
            'p_clinica_id': clinica_id,
            'p_data_inicio': data_inicio,
            'p_data_fim': data_fim
        }).execute()

        resumo = result.data or {}
        resumo['periodo'] = {'inicio': data_inicio, 'fim': data_fim}

        logger.info(f"✅ [FINANCEIRO] Resumo via RPC calculado")
        return jsonify(resumo), 200

    except Exception as e:
        logger.error(f"❌ [FINANCEIRO] Erro crítico: {str(e)}", exc_info=True)
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


@financeiro_bp.route('/pendencias', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_pendencias():
    """Retorna pagamentos pendentes segmentados por SQL (vencidos / a vencer)."""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        hoje = today_brazil().isoformat()

        from database.supabase_client import get_supabase_client
        client = get_supabase_client()

        base_query = (
            client.table('pagamentos_mensalidades')
            .select('*, pacientes(id, nome_completo, telefone_principal), mensalidades_pacientes(valor_mensalidade)')
            .eq('clinica_id', clinica_id)
            .eq('status', 'pendente')
        )

        # Duas queries com filtro de data no banco — sem carregamento total
        vencidos_res = base_query.lt('data_vencimento', hoje).order('data_vencimento').execute()
        a_vencer_res = base_query.gte('data_vencimento', hoje).order('data_vencimento').execute()

        def formatar(rows):
            result = []
            for item in (rows or []):
                paciente = item.pop('pacientes', None) or {}
                mens = item.pop('mensalidades_pacientes', None) or {}
                item['paciente_nome'] = paciente.get('nome_completo')
                item['paciente_telefone'] = paciente.get('telefone_principal')
                item['valor_mensalidade'] = mens.get('valor_mensalidade')
                result.append(item)
            return result

        vencidos = formatar(vencidos_res.data)
        a_vencer = formatar(a_vencer_res.data)

        return jsonify({
            'vencidos': vencidos,
            'a_vencer': a_vencer,
            'total_vencidos': len(vencidos),
            'total_a_vencer': len(a_vencer),
            'valor_vencido': sum(float(p.get('valor_pago', 0)) for p in vencidos),
            'valor_a_vencer': sum(float(p.get('valor_pago', 0)) for p in a_vencer)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
