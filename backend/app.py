# filepath: backend/app.py
# Entry point for local development.
# create_app is defined in app/__init__.py (standard Flask factory pattern).
import os
from app import create_app

if __name__ == '__main__':
    flask_app = create_app()
    flask_app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'True').lower() == 'true'
    )
