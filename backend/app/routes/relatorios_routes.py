# filepath: backend/app/routes/relatorios_routes.py
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.services.relatorio_service import RelatorioService
from app.utils.audit import log_access
from app.utils.tenant_query import TenantResourceNotFound
from io import BytesIO

logger = logging.getLogger(__name__)

relatorios_bp = Blueprint('relatorios', __name__, url_prefix='/relatorios')

# Tipos de arquivo permitidos
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}
ALLOWED_MIMETYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}


def allowed_file(filename):
    """Verifica se o arquivo é permitido"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@relatorios_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
def listar_relatorios():
    """
    Lista relatórios.
    Admin: vê todos. Profissional/fono/medico: apenas os próprios.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['id']
        
        # Filtros da query string
        filters = {}
        if request.args.get('paciente_id'):
            filters['paciente_id'] = request.args.get('paciente_id')
        if request.args.get('profissional_id'):
            filters['profissional_id'] = request.args.get('profissional_id')
        
        service = RelatorioService()
        relatorios = service.listar_relatorios(
            clinica_id, filters, user_role, user_id
        )
        
        return jsonify(relatorios), 200
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar relatórios: {str(e)}")
        return jsonify({'error': str(e)}), 500


@relatorios_bp.route('/<relatorio_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
@log_access('relatorio', 'view', id_param='relatorio_id')
def buscar_relatorio(relatorio_id):
    """Busca um relatório específico"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['id']
        
        service = RelatorioService()
        relatorio = service.buscar_relatorio(relatorio_id, clinica_id)
        
        if user_role in ('profissional', 'fono', 'medico'):
            if relatorio.get('profissional_id') != user_id:
                return jsonify({'error': 'Sem permissão para acessar este relatório'}), 403
        
        return jsonify(relatorio), 200

    except TenantResourceNotFound as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"❌ Erro ao buscar relatório: {str(e)}")
        return jsonify({'error': str(e)}), 500


@relatorios_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
def criar_relatorio():
    """
    Cria novo relatório com upload de arquivo.
    Profissional/fono/medico criam apenas para si mesmos.
    Admin pode criar para qualquer profissional.
    """
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        user_role = user.get('role')
        
        # Verificar se arquivo foi enviado
        if 'arquivo' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['arquivo']
        
        if file.filename == '':
            return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Tipo de arquivo não permitido. Use PDF, DOC ou DOCX'}), 400
        
        # Obter dados do formulário
        paciente_id = request.form.get('paciente_id')
        profissional_id = request.form.get('profissional_id', user_id)
        titulo = request.form.get('titulo')
        observacoes = request.form.get('observacoes')
        
        # Validações
        if not paciente_id:
            return jsonify({'error': 'paciente_id é obrigatório'}), 400
        
        if not titulo:
            return jsonify({'error': 'titulo é obrigatório'}), 400
        
        # Profissionais/fono/medico só podem criar relatórios para si mesmos
        if user_role in ('profissional', 'fono', 'medico') and profissional_id != user_id:
            return jsonify({'error': 'Você só pode criar relatórios para si mesmo'}), 403
        
        # Ler conteúdo do arquivo
        filename = secure_filename(file.filename)
        file_content = file.read()
        tipo_arquivo = file.content_type
        
        # Criar relatório
        service = RelatorioService()
        relatorio = service.criar_relatorio(
            clinica_id=clinica_id,
            paciente_id=paciente_id,
            profissional_id=profissional_id,
            titulo=titulo,
            file_content=file_content,
            file_name=filename,
            tipo_arquivo=tipo_arquivo,
            criado_por=user_id,
            observacoes=observacoes
        )
        
        return jsonify(relatorio), 201
        
    except Exception as e:
        logger.error(f"❌ Erro ao criar relatório: {str(e)}")
        return jsonify({'error': str(e)}), 500


@relatorios_bp.route('/<relatorio_id>/download', methods=['GET'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
@log_access('relatorio', 'download', id_param='relatorio_id')
def download_relatorio(relatorio_id):
    """Faz download do arquivo do relatório"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_role = user.get('role')
        user_id = user['id']
        
        service = RelatorioService()
        
        relatorio = service.buscar_relatorio(relatorio_id, clinica_id)
        
        if user_role in ('profissional', 'fono', 'medico'):
            if relatorio.get('profissional_id') != user_id:
                return jsonify({'error': 'Sem permissão para baixar este relatório'}), 403
        
        file_data = service.download_arquivo(relatorio_id, clinica_id)
        
        # Preparar para envio
        file_buffer = BytesIO(file_data)
        file_buffer.seek(0)
        
        return send_file(
            file_buffer,
            mimetype=relatorio['tipo_arquivo'],
            as_attachment=True,
            download_name=relatorio['nome_arquivo_original']
        )

    except TenantResourceNotFound as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"❌ Erro ao fazer download: {str(e)}")
        return jsonify({'error': str(e)}), 500


@relatorios_bp.route('/<relatorio_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
def atualizar_relatorio(relatorio_id):
    """Atualiza informações do relatório (não o arquivo)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        user_role = user.get('role')
        
        dados = request.get_json()
        
        if user_role in ('profissional', 'fono', 'medico'):
            relatorio = RelatorioService().buscar_relatorio(relatorio_id, clinica_id)
            if relatorio['profissional_id'] != user_id:
                return jsonify({'error': 'Você só pode editar seus próprios relatórios'}), 403
        
        service = RelatorioService()
        relatorio_atualizado = service.atualizar_relatorio(
            relatorio_id, clinica_id, dados
        )
        
        return jsonify(relatorio_atualizado), 200

    except TenantResourceNotFound as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar relatório: {str(e)}")
        return jsonify({'error': str(e)}), 500


@relatorios_bp.route('/<relatorio_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'profissional', 'fono', 'medico'])
def excluir_relatorio(relatorio_id):
    """Exclui relatório e arquivo"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        user_role = user.get('role')
        
        if user_role in ('profissional', 'fono', 'medico'):
            service = RelatorioService()
            relatorio = service.buscar_relatorio(relatorio_id, clinica_id)
            if relatorio['profissional_id'] != user_id:
                return jsonify({'error': 'Você só pode excluir seus próprios relatórios'}), 403
        
        service = RelatorioService()
        service.excluir_relatorio(relatorio_id, clinica_id)
        
        return jsonify({'message': 'Relatório excluído com sucesso'}), 200

    except TenantResourceNotFound as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"❌ Erro ao excluir relatório: {str(e)}")
        return jsonify({'error': str(e)}), 500
