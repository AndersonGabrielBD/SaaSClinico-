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
@require_roles(['admin', 'recepcao'])
def registrar_frequencia():
    """
    Registra frequência de atendimento.
    Apenas Admin/Recepcao podem registrar frequência.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['user_id']
        
        # Validar dados
        dados = FrequenciaCreate(**request.json)
        
        service = FrequenciaService()
        frequencia = service.registrar_frequencia(
            clinica_id=clinica_id,
            paciente_id=dados.paciente_id,
            profissional_id=dados.profissional_id,
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
@require_roles(['admin', 'recepcao'])
def atualizar_frequencia(frequencia_id):
    """
    Atualiza um registro de frequência.
    Apenas Admin/Recepcao podem atualizar frequência.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        dados_atualizacao = request.json
        
        # Admin/Recepcao podem alterar profissional_id (ex: correção). Paciente não alterável.
        dados_atualizacao.pop('paciente_id', None)
        
        service = FrequenciaService()
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
        
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        ano = request.args.get('ano')
        mes = request.args.get('mes')
        somente_faltas = request.args.get('somente_faltas', '').lower() in ('1', 'true', 'yes')

        if data_inicio and data_fim:
            if data_inicio > data_fim:
                return jsonify({'error': 'data_inicio não pode ser maior que data_fim'}), 400
        elif not ano or not mes:
            return jsonify({'error': 'Informe data_inicio e data_fim ou ano e mes'}), 400

        service = FrequenciaService()

        profissional_id = None
        if user_role in ['fono', 'medico', 'profissional']:
            profissional_id = user_id

        resumo = service.get_resumo_mensal(
            clinica_id,
            ano=ano,
            mes=mes,
            profissional_id=profissional_id,
            data_inicio_param=data_inicio,
            data_fim_param=data_fim,
            somente_faltas=somente_faltas,
        )

        return jsonify(resumo), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar resumo mensal: {str(e)}")
        return jsonify({'error': str(e)}), 500


@frequencia_bp.route('/export-pdf', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def export_frequencia_pdf():
    """Exporta relatório de frequência mensal em PDF"""
    from flask import send_file
    from app.services.pdf_service import PdfService
    
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['user_id']
        
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        ano = request.args.get('ano')
        mes = request.args.get('mes')
        somente_faltas = request.args.get('somente_faltas', '').lower() in ('1', 'true', 'yes')

        if data_inicio and data_fim:
            if data_inicio > data_fim:
                return jsonify({'error': 'data_inicio não pode ser maior que data_fim'}), 400
        elif not ano or not mes:
            return jsonify({'error': 'Informe data_inicio e data_fim ou ano e mes'}), 400

        logger.info(f"📄 [PDF] Exportando frequência clinica_id={clinica_id}")

        service = FrequenciaService()

        profissional_id = None
        if user_role in ['fono', 'medico', 'profissional']:
            profissional_id = user_id

        frequencia_data = service.get_resumo_mensal(
            clinica_id,
            ano=ano,
            mes=mes,
            profissional_id=profissional_id,
            data_inicio_param=data_inicio,
            data_fim_param=data_fim,
            somente_faltas=somente_faltas,
        )

        pdf_service = PdfService()
        filtros_info = {
            'mes': mes,
            'ano': ano,
            'data_inicio': data_inicio,
            'data_fim': data_fim,
            'somente_faltas': somente_faltas,
        }
        pdf_buffer = pdf_service.generate_frequencia_pdf(frequencia_data, filtros_info)

        if data_inicio and data_fim:
            filename = f'frequencia_{data_inicio}_a_{data_fim}.pdf'
        else:
            filename = f'frequencia_{mes}_{ano}.pdf'
        
        logger.info(f"✅ [PDF] Frequência exportada com sucesso: {filename}")
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"❌ Erro ao exportar PDF de frequência: {str(e)}")
        return jsonify({'error': str(e)}), 500
