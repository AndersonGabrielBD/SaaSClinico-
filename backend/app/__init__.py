"""
ClinFlow Backend
Multi-tenant speech therapy clinic management system
Built with Flask + Supabase
"""

__version__ = "1.0.0"

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from config import Config
import os
import logging

load_dotenv()
Config.validate()  # Falha na subida se SUPABASE_SERVICE_ROLE_KEY etc. faltando

_log_level = logging.WARNING if os.getenv('ENVIRONMENT', 'development') == 'production' else logging.INFO
logging.basicConfig(
    level=_log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app():
    """Factory para criar a aplicação Flask"""
    app = Flask(__name__)

    app.config['SECRET_KEY'] = Config.SECRET_KEY
    app.config['JSON_SORT_KEYS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

    CORS(app,
         origins="*",
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
         supports_credentials=False)

    from app.routes.auth_routes import auth_bp
    from app.routes.paciente_routes import paciente_bp
    from app.routes.prontuario_routes import prontuario_bp
    from app.routes.agendamento_routes import agendamento_bp
    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.usuario_routes import usuario_bp
    from app.routes.sala_routes import sala_bp
    from app.routes.tipo_atendimento_routes import tipo_atendimento_bp
    from app.routes.verificacao_routes import verificacao_bp
    from app.routes.financeiro_routes import financeiro_bp
    from app.routes.mensalidades_routes import mensalidades_bp
    from app.routes.relatorios_routes import relatorios_bp
    from app.routes.frequencia_routes import frequencia_bp
    from app.routes.profissional_routes import profissional_bp
    from app.routes.senha_routes import senha_bp
    from app.routes.pacote_routes import pacote_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(usuario_bp, url_prefix='/usuarios')
    app.register_blueprint(paciente_bp, url_prefix='/pacientes')
    app.register_blueprint(prontuario_bp, url_prefix='/prontuarios')
    app.register_blueprint(agendamento_bp, url_prefix='/agendamentos')
    app.register_blueprint(sala_bp, url_prefix='/salas')
    app.register_blueprint(tipo_atendimento_bp, url_prefix='/tipos-atendimento')
    app.register_blueprint(verificacao_bp, url_prefix='/verificacao')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(financeiro_bp, url_prefix='/financeiro')
    app.register_blueprint(mensalidades_bp, url_prefix='/mensalidades')
    app.register_blueprint(relatorios_bp, url_prefix='/relatorios')
    app.register_blueprint(frequencia_bp, url_prefix='/frequencia')
    app.register_blueprint(profissional_bp, url_prefix='/profissionais')
    app.register_blueprint(senha_bp, url_prefix='/senha')
    app.register_blueprint(pacote_bp, url_prefix='/pacotes')

    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'ok',
            'environment': os.getenv('ENVIRONMENT', 'development'),
            'version': '1.0.0'
        })

    @app.route('/')
    def root():
        return jsonify({
            'name': 'ClinFlow API',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/auth',
                'usuarios': '/usuarios',
                'pacientes': '/pacientes',
                'prontuarios': '/prontuarios',
                'agendamentos': '/agendamentos',
                'salas': '/salas',
                'verificacao': '/verificacao',
                'dashboard': '/dashboard',
                'financeiro': '/financeiro',
                'mensalidades': '/mensalidades',
                'relatorios': '/relatorios',
                'frequencia': '/frequencia',
                'profissionais': '/profissionais',
                'pacotes': '/pacotes',
                'health': '/health'
            }
        })

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad Request', 'message': str(error)}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized', 'message': 'Token inválido ou ausente'}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden', 'message': 'Acesso negado'}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not Found', 'message': 'Recurso não encontrado'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f'Internal Server Error: {str(error)}')
        return jsonify({'error': 'Internal Server Error', 'message': 'Erro interno do servidor'}), 500

    logger.info('🚀 ClinFlow Backend iniciado')
    logger.info(f'📊 Ambiente: {os.getenv("ENVIRONMENT", "development")}')

    return app
