# filepath: backend/app/routes/mensalidades_routes.py
import logging
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.services.mensalidade_service import MensalidadeService
from app.schemas.mensalidade_schema import (
    MensalidadeCreate, MensalidadeUpdate, MensalidadeResponse,
    PagamentoCreate, PagamentoUpdate, MarcarPagoRequest,
    AlterarDataVencimentoRequest, ProximoVencimentoResponse,
    EstatisticasMensalidadesResponse
)
from pydantic import ValidationError
from datetime import date, datetime

logger = logging.getLogger(__name__)

mensalidades_bp = Blueprint('mensalidades', __name__, url_prefix='/mensalidades')


# ============================================================================
# ROTAS DE MENSALIDADES
# ============================================================================

@mensalidades_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def listar_mensalidades():
    """Lista todas as mensalidades da clínica"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        ativo = request.args.get('ativo')
        if ativo is not None:
            ativo = ativo.lower() == 'true'
        
        service = MensalidadeService()
        mensalidades = service.listar_mensalidades(clinica_id, ativo)
        
        return jsonify(mensalidades), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar mensalidades: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/<mensalidade_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def buscar_mensalidade(mensalidade_id):
    """Busca uma mensalidade específica"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        mensalidade = service.buscar_mensalidade(mensalidade_id, clinica_id)
        
        return jsonify(mensalidade), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar mensalidade: {str(e)}")
        return jsonify({'error': str(e)}), 404


@mensalidades_bp.route('/paciente/<paciente_id>', methods=['GET'])
@require_auth
def buscar_mensalidade_paciente(paciente_id):
    """Busca mensalidade de um paciente específico"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        mensalidade = service.buscar_mensalidade_por_paciente(paciente_id, clinica_id)
        
        if not mensalidade:
            return jsonify({'message': 'Paciente não possui mensalidade cadastrada'}), 404
        
        return jsonify(mensalidade), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar mensalidade do paciente: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def criar_mensalidade():
    """Cria uma nova mensalidade para um paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['user_id']
        
        # Validar dados
        dados = MensalidadeCreate(**request.json)
        
        service = MensalidadeService()
        mensalidade = service.criar_mensalidade(
            clinica_id=clinica_id,
            paciente_id=dados.paciente_id,
            valor_mensalidade=dados.valor_mensalidade,
            dia_vencimento=dados.dia_vencimento,
            criado_por=user_id,
            observacoes=dados.observacoes
        )
        
        return jsonify(mensalidade), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"❌ Erro ao criar mensalidade: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/<mensalidade_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def atualizar_mensalidade(mensalidade_id):
    """Atualiza uma mensalidade existente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Validar dados
        dados = MensalidadeUpdate(**request.json)
        dados_dict = dados.dict(exclude_unset=True)
        
        service = MensalidadeService()
        mensalidade = service.atualizar_mensalidade(mensalidade_id, clinica_id, dados_dict)
        
        return jsonify(mensalidade), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar mensalidade: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/<mensalidade_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def desativar_mensalidade(mensalidade_id):
    """Desativa uma mensalidade (soft delete)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        mensalidade = service.desativar_mensalidade(mensalidade_id, clinica_id)
        
        return jsonify(mensalidade), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao desativar mensalidade: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/gerar-mes-atual', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def gerar_pagamentos_mes():
    """Gera pagamentos do mês atual para todas as mensalidades ativas"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        contador = service.gerar_pagamentos_mes_corrente(clinica_id)
        
        return jsonify({
            'message': f'{contador} pagamentos gerados com sucesso',
            'total': contador
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Erro ao gerar pagamentos do mês: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# ROTAS DE PAGAMENTOS
# ============================================================================

@mensalidades_bp.route('/pagamentos', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def listar_pagamentos():
    """Lista pagamentos com filtros opcionais"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Filtros
        filters = {}
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('mes_referencia'):
            filters['mes_referencia'] = request.args.get('mes_referencia')
        if request.args.get('paciente_id'):
            filters['paciente_id'] = request.args.get('paciente_id')
        if request.args.get('data_inicio'):
            filters['data_inicio'] = request.args.get('data_inicio')
        if request.args.get('data_fim'):
            filters['data_fim'] = request.args.get('data_fim')
        
        service = MensalidadeService()
        pagamentos = service.listar_pagamentos(clinica_id, filters)
        
        return jsonify(pagamentos), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar pagamentos: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/pagamentos/<pagamento_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def buscar_pagamento(pagamento_id):
    """Busca um pagamento específico"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        pagamento = service.buscar_pagamento(pagamento_id, clinica_id)
        
        return jsonify(pagamento), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar pagamento: {str(e)}")
        return jsonify({'error': str(e)}), 404


@mensalidades_bp.route('/pagamentos/<pagamento_id>/marcar-pago', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def marcar_pago(pagamento_id):
    """Marca um pagamento como pago"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['user_id']
        
        # Validar dados
        dados = MarcarPagoRequest(**request.json)
        
        service = MensalidadeService()
        pagamento = service.marcar_pagamento_pago(
            pagamento_id=pagamento_id,
            clinica_id=clinica_id,
            metodo_pagamento=dados.metodo_pagamento,
            valor_pago=dados.valor_pago,
            registrado_por=user_id,
            data_pagamento=dados.data_pagamento,
            observacoes=dados.observacoes
        )
        
        return jsonify(pagamento), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except Exception as e:
        logger.error(f"❌ Erro ao marcar pagamento como pago: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/pagamentos/<pagamento_id>/marcar-pendente', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def marcar_pendente(pagamento_id):
    """Marca um pagamento como pendente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        service = MensalidadeService()
        pagamento = service.marcar_pagamento_pendente(
            pagamento_id=pagamento_id,
            clinica_id=clinica_id
        )

        return jsonify(pagamento), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"❌ Erro ao marcar pagamento como pendente: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/pagamentos/<pagamento_id>/alterar-vencimento', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def alterar_vencimento(pagamento_id):
    """Altera a data de vencimento de um pagamento"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Validar dados
        dados = AlterarDataVencimentoRequest(**request.json)
        
        service = MensalidadeService()
        pagamento = service.alterar_data_vencimento(
            pagamento_id=pagamento_id,
            clinica_id=clinica_id,
            nova_data=dados.nova_data_vencimento
        )
        
        return jsonify(pagamento), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except Exception as e:
        logger.error(f"❌ Erro ao alterar data de vencimento: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/proximos-vencimentos', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def proximos_vencimentos():
    """Retorna pagamentos com vencimento próximo (2-3 dias)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        dias = int(request.args.get('dias', 3))
        
        service = MensalidadeService()
        vencimentos = service.calcular_proximos_vencimentos(clinica_id, dias)
        
        return jsonify(vencimentos), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar próximos vencimentos: {str(e)}")
        return jsonify({'error': str(e)}), 500


@mensalidades_bp.route('/estatisticas', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def estatisticas():
    """Retorna estatísticas do sistema de mensalidades"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        stats = service.obter_estatisticas(clinica_id)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao calcular estatísticas: {str(e)}")
        return jsonify({'error': str(e)}), 500
