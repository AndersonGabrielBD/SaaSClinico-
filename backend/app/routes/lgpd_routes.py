"""
Rotas LGPD — Data Subject Requests (DSR).

Permite exportação e anonimização de dados de pacientes,
conforme Lei Geral de Proteção de Dados (Lei 13.709/2018).
"""
import logging
from flask import Blueprint, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.utils.audit import audit_log_entry
from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

lgpd_bp = Blueprint('lgpd', __name__, url_prefix='/lgpd')


@lgpd_bp.route('/export/<paciente_id>', methods=['GET'])
@require_auth
@require_roles(['admin'])
def export_patient_data(paciente_id):
    """
    Exporta todos os dados de um paciente em formato JSON.
    Apenas admins podem executar (atende LGPD Art. 18, II - acesso aos dados).
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        client = get_supabase_client()

        paciente = client.table('pacientes') \
            .select('*') \
            .eq('id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .single() \
            .execute()

        if not paciente.data:
            return jsonify({'error': 'Paciente não encontrado'}), 404

        prontuarios = client.table('prontuarios') \
            .select('id, titulo, conteudo, data_criacao, data_atualizacao') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()

        agendamentos = client.table('agendamentos') \
            .select('id, data_agendamento, horario_inicio, horario_fim, status, tipo_atendimento, observacoes') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()

        lancamentos = client.table('lancamentos_financeiros') \
            .select('id, descricao, valor, tipo, status, data_vencimento, data_pagamento') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()

        frequencias = client.table('frequencia_atendimentos') \
            .select('id, data_atendimento, presente, observacoes') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()

        export_data = {
            'paciente': paciente.data,
            'prontuarios': prontuarios.data or [],
            'agendamentos': agendamentos.data or [],
            'lancamentos_financeiros': lancamentos.data or [],
            'frequencias': frequencias.data or [],
            'exportado_em': __import__('datetime').datetime.utcnow().isoformat(),
            'exportado_por': user['id'],
        }

        audit_log_entry(
            clinica_id=clinica_id,
            user_id=user['id'],
            user_role=user.get('role'),
            action='export',
            resource_type='paciente',
            resource_id=paciente_id,
            details={'tipo': 'dsr_export', 'tabelas': ['pacientes', 'prontuarios', 'agendamentos', 'lancamentos', 'frequencias']},
        )

        return jsonify(export_data), 200

    except Exception as e:
        logger.error(f"[LGPD] Erro ao exportar dados: {e}")
        return jsonify({'error': str(e)}), 500


@lgpd_bp.route('/anonymize/<paciente_id>', methods=['POST'])
@require_auth
@require_roles(['admin'])
def anonymize_patient(paciente_id):
    """
    Anonimiza dados pessoais de um paciente, mantendo registros clínicos.
    LGPD Art. 18, VI — eliminação dos dados pessoais.

    Campos anonimizados: nome, CPF, telefone, email, endereço.
    Campos mantidos: registros clínicos (prontuários, agendamentos) com referência anonimizada.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        client = get_supabase_client()

        paciente = client.table('pacientes') \
            .select('id, nome_completo') \
            .eq('id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .single() \
            .execute()

        if not paciente.data:
            return jsonify({'error': 'Paciente não encontrado'}), 404

        nome_original = paciente.data.get('nome_completo', '')

        anon_data = {
            'nome_completo': f'[ANONIMIZADO-{paciente_id[:8]}]',
            'cpf': None,
            'telefone_principal': None,
            'telefone_secundario': None,
            'email': None,
            'endereco': None,
            'cidade': None,
            'estado': None,
            'cep': None,
            'observacoes': '[Dados anonimizados por solicitação LGPD]',
            'ativo': False,
        }

        client.table('pacientes') \
            .update(anon_data) \
            .eq('id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()

        audit_log_entry(
            clinica_id=clinica_id,
            user_id=user['id'],
            user_role=user.get('role'),
            action='anonymize',
            resource_type='paciente',
            resource_id=paciente_id,
            details={
                'tipo': 'dsr_anonymize',
                'nome_original_hash': hash(nome_original),
                'campos_anonimizados': list(anon_data.keys()),
            },
        )

        return jsonify({
            'message': 'Dados do paciente anonimizados com sucesso',
            'paciente_id': paciente_id,
            'campos_anonimizados': list(anon_data.keys()),
        }), 200

    except Exception as e:
        logger.error(f"[LGPD] Erro ao anonimizar dados: {e}")
        return jsonify({'error': str(e)}), 500


@lgpd_bp.route('/audit-log', methods=['GET'])
@require_auth
@require_roles(['admin'])
def list_audit_log():
    """Lista audit log da clínica (últimos 100 registros)."""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        client = get_supabase_client()

        from flask import request as flask_request
        resource_type = flask_request.args.get('resource_type')
        resource_id = flask_request.args.get('resource_id')
        limit = min(int(flask_request.args.get('limit', 100)), 500)

        query = client.table('audit_log') \
            .select('*') \
            .eq('clinica_id', clinica_id) \
            .order('created_at', desc=True) \
            .limit(limit)

        if resource_type:
            query = query.eq('resource_type', resource_type)
        if resource_id:
            query = query.eq('resource_id', resource_id)

        response = query.execute()

        return jsonify(response.data or []), 200

    except Exception as e:
        logger.error(f"[LGPD] Erro ao listar audit log: {e}")
        return jsonify({'error': str(e)}), 500
