"""
Vercel serverless function handler
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

# Cria a aplicação Flask
app = create_app()

# Vercel handler
handler = app

