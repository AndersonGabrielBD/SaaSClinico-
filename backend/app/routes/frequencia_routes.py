# filepath: backend/app/routes/frequencia_routes.py
import logging
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.services.frequencia_service import FrequenciaService
from app.schemas.frequencia_schema import (
    FrequenciaCreate, FrequenciaResponse,
    EstatisticasFrequenciaResponse, FrequenciaPorProfissional
)
from pydantic import ValidationError

logger = logging.getLogger(__name__)

frequencia_bp = Blueprint('frequencia', __name__, url_prefix='/frequencia')


@frequencia_bp.route('', methods=['POST'])
@require_auth
def registrar_frequencia():
    """
    Registra frequência de atendimento.
    Profissionais registram para seus próprios atendimentos.
    Admin/Recepcao podem registrar para qualquer profissional.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['user_id']
        user_role = user.get('role')
        
        # Validar dados
        dados = FrequenciaCreate(**request.json)
        
        # Se não for admin/recepcao, força profissional_id = user_id
        profissional_id = dados.profissional_id
        if user_role not in ['admin', 'recepcao']:
            profissional_id = user_id
        
        service = FrequenciaService()
        frequencia = service.registrar_frequencia(
            clinica_id=clinica_id,
            paciente_id=dados.paciente_id,
            profissional_id=profissional_id,
            data_atendimento=dados.data_atendimento,
            compareceu=dados.compareceu,
            registrado_por=user_id,
            agendamento_id=dados.agendamento_id,
            observacoes=dados.observacoes
        )
        
        return jsonify(frequencia), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Dados inválidos', 'details': e.errors()}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"❌ Erro ao registrar frequência: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/paciente/<paciente_id>', methods=['GET'])
@require_auth
def listar_frequencia_paciente(paciente_id):
    """
    Lista frequência de um paciente.
    Pode filtrar por profissional via query param.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        profissional_id = request.args.get('profissional_id')
        
        # Se profissional, força filtro para seus próprios registros
        if user_role not in ['admin', 'recepcao']:
            profissional_id = user_id
        
        service = FrequenciaService()
        frequencias = service.listar_frequencia_paciente(
            paciente_id, clinica_id, profissional_id
        )
        
        return jsonify(frequencias), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar frequência do paciente: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/paciente/<paciente_id>/estatisticas', methods=['GET'])
@require_auth
def estatisticas_paciente(paciente_id):
    """
    Calcula estatísticas de frequência de um paciente.
    Pode filtrar por profissional via query param.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        profissional_id = request.args.get('profissional_id')
        
        # Se profissional, força filtro para seus próprios registros
        if user_role not in ['admin', 'recepcao']:
            profissional_id = user_id
        
        service = FrequenciaService()
        stats = service.calcular_estatisticas_paciente(
            paciente_id, clinica_id, profissional_id
        )
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao calcular estatísticas: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/paciente/<paciente_id>/por-profissional', methods=['GET'])
@require_auth
def estatisticas_por_profissional(paciente_id):
    """
    Calcula estatísticas de frequência agrupadas por profissional.
    Admin/Recepcao veem todos, profissional vê apenas suas próprias.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        service = FrequenciaService()
        stats_list = service.calcular_estatisticas_por_profissional(
            paciente_id, clinica_id
        )
        
        # Se profissional, filtrar apenas suas estatísticas
        if user_role not in ['admin', 'recepcao']:
            stats_list = [s for s in stats_list if s['profissional_id'] == user_id]
        
        return jsonify(stats_list), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao calcular estatísticas por profissional: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/profissional/<profissional_id>', methods=['GET'])
@require_auth
def listar_frequencia_profissional(profissional_id):
    """
    Lista todos os registros de frequência de um profissional.
    Profissional só acessa seus próprios, admin/recepcao acessam todos.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        # Verificar permissão
        if user_role not in ['admin', 'recepcao'] and profissional_id != user_id:
            return jsonify({'error': 'Acesso negado'}), 403
        
        service = FrequenciaService()
        frequencias = service.listar_frequencia_profissional(
            profissional_id, clinica_id
        )
        
        return jsonify(frequencias), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar frequência do profissional: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/<frequencia_id>', methods=['PUT'])
@require_auth
def atualizar_frequencia(frequencia_id):
    """
    Atualiza um registro de frequência.
    Profissional atualiza seus próprios, admin atualiza todos.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        # Buscar frequência para verificar permissão
        service = FrequenciaService()
        # TODO: Adicionar método buscar_frequencia no service
        
        dados_atualizacao = request.json
        
        # Não permite alterar profissional_id ou paciente_id
        dados_atualizacao.pop('profissional_id', None)
        dados_atualizacao.pop('paciente_id', None)
        
        frequencia = service.atualizar_frequencia(
            frequencia_id, clinica_id, dados_atualizacao
        )
        
        return jsonify(frequencia), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar frequência: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/<frequencia_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def deletar_frequencia(frequencia_id):
    """Deleta um registro de frequência (admin e recepcionista)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = FrequenciaService()
        service.deletar_frequencia(frequencia_id, clinica_id)
        
        return jsonify({'message': 'Frequência deletada com sucesso'}), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao deletar frequência: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/todos-pacientes', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def listar_estatisticas_todos_pacientes():
    """
    Lista estatísticas de frequência de todos os pacientes.
    - Admin/Recepcao: veem todos os pacientes
    - Profissionais: veem apenas pacientes vinculados a eles
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        service = FrequenciaService()
        
        # Se for profissional, filtra apenas seus pacientes
        if user_role in ['fono', 'medico', 'profissional']:
            stats = service.listar_estatisticas_pacientes_profissional(
                clinica_id, user_id
            )
        else:
            # Admin e recepção veem todos
            stats = service.listar_estatisticas_todos_pacientes(clinica_id)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar estatísticas de todos pacientes: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/resumo-mensal', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_resumo_mensal():
    """
    Retorna resumo mensal de consultas para cálculo de pagamento dos profissionais.
    Agrupa por profissional e por paciente, com detalhes de datas.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        # Query params
        ano = request.args.get('ano')
        mes = request.args.get('mes')
        
        if not ano or not mes:
            return jsonify({'error': 'Parâmetros ano e mes são obrigatórios'}), 400
        
        service = FrequenciaService()
        
        # Se for profissional, filtra apenas seus dados
        profissional_id = None
        if user_role in ['fono', 'medico', 'profissional']:
            profissional_id = user_id
        
        resumo = service.get_resumo_mensal(clinica_id, ano, mes, profissional_id)
        
        return jsonify(resumo), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar resumo mensal: {str(e)}")
        return jsonify({'error': str(e)}), 500
