import logging
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.services.pacote_service import PacoteService
from app.schemas.pacote_schema import (
    TipoProfissionalCreate, TipoProfissionalUpdate,
    PacoteCreate, PacoteUpdate,
    MarcarPagoPacoteRequest,
)
from pydantic import ValidationError

logger = logging.getLogger(__name__)

pacote_bp = Blueprint('pacotes', __name__, url_prefix='/pacotes')


# =============================================================================
# PROFISSIONAIS DISPONÍVEIS
# =============================================================================

@pacote_bp.route('/profissionais', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def listar_profissionais():
    try:
        user = get_current_user()
        service = PacoteService()
        profissionais = service.listar_profissionais(user['clinica_id'])
        return jsonify(profissionais), 200
    except Exception as e:
        logger.error(f"listar_profissionais: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# TIPOS DE PROFISSIONAL
# =============================================================================

@pacote_bp.route('/tipos-profissional', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def listar_tipos():
    try:
        user = get_current_user()
        ativo = request.args.get('ativo')
        if ativo is not None:
            ativo = ativo.lower() == 'true'
        service = PacoteService()
        tipos = service.listar_tipos(user['clinica_id'], ativo)
        return jsonify(tipos), 200
    except Exception as e:
        logger.error(f"listar_tipos: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/tipos-profissional/<tipo_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def buscar_tipo(tipo_id):
    try:
        user = get_current_user()
        service = PacoteService()
        tipo = service.buscar_tipo(tipo_id, user['clinica_id'])
        return jsonify(tipo), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"buscar_tipo: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/tipos-profissional', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def criar_tipo():
    try:
        user = get_current_user()
        dados = TipoProfissionalCreate(**request.json)
        service = PacoteService()
        tipo = service.criar_tipo(
            user['clinica_id'],
            dados.nome,
            dados.valor_sessao,
            profissional_id=dados.profissional_id,
        )
        return jsonify(tipo), 201
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except Exception as e:
        logger.error(f"criar_tipo: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/tipos-profissional/<tipo_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def atualizar_tipo(tipo_id):
    try:
        user = get_current_user()
        dados = TipoProfissionalUpdate(**request.json)
        dados_dict = dados.dict(exclude_unset=True)
        service = PacoteService()
        tipo = service.atualizar_tipo(tipo_id, user['clinica_id'], dados_dict)
        return jsonify(tipo), 200
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"atualizar_tipo: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/tipos-profissional/<tipo_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def excluir_tipo(tipo_id):
    try:
        user = get_current_user()
        service = PacoteService()
        tipo = service.excluir_tipo(tipo_id, user['clinica_id'])
        return jsonify(tipo), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"excluir_tipo: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# PACOTES
# =============================================================================

@pacote_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def listar_pacotes():
    try:
        user = get_current_user()
        ativo = request.args.get('ativo')
        if ativo is not None:
            ativo = ativo.lower() == 'true'
        service = PacoteService()
        pacotes = service.listar_pacotes(user['clinica_id'], ativo)
        return jsonify(pacotes), 200
    except Exception as e:
        logger.error(f"listar_pacotes: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/<pacote_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def buscar_pacote(pacote_id):
    try:
        user = get_current_user()
        service = PacoteService()
        pacote = service.buscar_pacote(pacote_id, user['clinica_id'])
        return jsonify(pacote), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"buscar_pacote: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def criar_pacote():
    try:
        user = get_current_user()
        dados = PacoteCreate(**request.json)
        service = PacoteService()
        pacote = service.criar_pacote(
            clinica_id=user['clinica_id'],
            paciente_id=dados.paciente_id,
            itens=[it.dict() for it in dados.itens],
            criado_por=user['user_id'],
            observacoes=dados.observacoes,
        )
        return jsonify(pacote), 201
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"criar_pacote: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/<pacote_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def atualizar_pacote(pacote_id):
    try:
        user = get_current_user()
        dados = PacoteUpdate(**request.json)
        dados_dict = dados.dict(exclude_unset=True)
        if 'itens' in dados_dict and dados_dict['itens'] is not None:
            dados_dict['itens'] = [
                it.dict() if hasattr(it, 'dict') else it
                for it in dados_dict['itens']
            ]
        service = PacoteService()
        pacote = service.atualizar_pacote(pacote_id, user['clinica_id'], dados_dict)
        return jsonify(pacote), 200
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"atualizar_pacote: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/<pacote_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def excluir_pacote(pacote_id):
    try:
        user = get_current_user()
        service = PacoteService()
        pacote = service.excluir_pacote(pacote_id, user['clinica_id'])
        return jsonify(pacote), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"excluir_pacote: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/<pacote_id>/ativar', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def ativar_pacote(pacote_id):
    try:
        user = get_current_user()
        service = PacoteService()
        pacote = service.ativar_pacote(pacote_id, user['clinica_id'])
        return jsonify(pacote), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"ativar_pacote: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# PAGAMENTO DO PACOTE (inline)
# =============================================================================

@pacote_bp.route('/<pacote_id>/marcar-pago', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def marcar_pago(pacote_id):
    try:
        user = get_current_user()
        dados = MarcarPagoPacoteRequest(**request.json)
        service = PacoteService()
        pacote = service.marcar_pago(
            pacote_id=pacote_id,
            clinica_id=user['clinica_id'],
            metodo_pagamento=dados.metodo_pagamento,
            valor_pago=dados.valor_pago,
            registrado_por=user['user_id'],
            observacoes=dados.observacoes,
        )
        return jsonify(pacote), 200
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"marcar_pago: {e}")
        return jsonify({'error': str(e)}), 500


@pacote_bp.route('/<pacote_id>/marcar-pendente', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def marcar_pendente(pacote_id):
    try:
        user = get_current_user()
        service = PacoteService()
        pacote = service.marcar_pendente(pacote_id, user['clinica_id'])
        return jsonify(pacote), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"marcar_pendente: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# ESTATÍSTICAS
# =============================================================================

@pacote_bp.route('/estatisticas', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def estatisticas():
    try:
        user = get_current_user()
        service = PacoteService()
        stats = service.obter_estatisticas(user['clinica_id'])
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"estatisticas: {e}")
        return jsonify({'error': str(e)}), 500
