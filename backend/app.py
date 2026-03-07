# filepath: backend/app.py
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

# Configure logging
_log_level = logging.WARNING if os.getenv('ENVIRONMENT', 'development') == 'production' else logging.INFO
logging.basicConfig(
    level=_log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Factory para criar a aplicação Flask"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['JSON_SORT_KEYS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
    
    # CORS Configuration - Simples e eficaz
    CORS(app, 
         origins="*",
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
         supports_credentials=False)
    
    # Register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.paciente_routes import paciente_bp
    from app.routes.prontuario_routes import prontuario_bp
    from app.routes.agendamento_routes import agendamento_bp
    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.usuario_routes import usuario_bp
    from app.routes.sala_routes import sala_bp
    from app.routes.verificacao_routes import verificacao_bp
    from app.routes.financeiro_routes import financeiro_bp
    from app.routes.mensalidades_routes import mensalidades_bp
    from app.routes.relatorios_routes import relatorios_bp
    from app.routes.frequencia_routes import frequencia_bp
    from app.routes.profissional_routes import profissional_bp
    from app.routes.senha_routes import senha_bp
    
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(usuario_bp, url_prefix='/usuarios')
    app.register_blueprint(paciente_bp, url_prefix='/pacientes')
    app.register_blueprint(prontuario_bp, url_prefix='/prontuarios')
    app.register_blueprint(agendamento_bp, url_prefix='/agendamentos')
    app.register_blueprint(sala_bp, url_prefix='/salas')
    app.register_blueprint(verificacao_bp, url_prefix='/verificacao')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(financeiro_bp, url_prefix='/financeiro')
    app.register_blueprint(mensalidades_bp, url_prefix='/mensalidades')
    app.register_blueprint(relatorios_bp, url_prefix='/relatorios')
    app.register_blueprint(frequencia_bp, url_prefix='/frequencia')
    app.register_blueprint(profissional_bp, url_prefix='/profissionais')
    app.register_blueprint(senha_bp, url_prefix='/senha')
    
    # Health check
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'ok',
            'environment': os.getenv('ENVIRONMENT', 'development'),
            'version': '1.0.0'
        })
    
    # Root endpoint
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
                'health': '/health'
            }
        })
    
    # Error handlers
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

if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'True').lower() == 'true'
    )
