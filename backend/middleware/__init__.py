"""Middleware module"""
from .auth_middleware import jwt_required

__all__ = ['jwt_required']
