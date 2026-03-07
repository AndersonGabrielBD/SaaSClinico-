"""
Vercel serverless function handler
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

# Vercel uses the 'app' variable as the WSGI entrypoint
app = create_app()

