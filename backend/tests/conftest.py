"""
Fixtures compartilhadas para testes do clinnext.

Usa mocks do Supabase para rodar sem banco real.
Dois tenants (clínica A e B) com usuários de diferentes roles.
"""
import os
import sys
import uuid
import pytest
from unittest.mock import MagicMock, patch

# Garante que o backend está no path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-ci')
os.environ.setdefault('SUPABASE_URL', 'https://fake.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', 'fake-service-role-key')
os.environ.setdefault('SUPABASE_JWT_SECRET', 'fake-jwt-secret')
os.environ.setdefault('ENVIRONMENT', 'testing')
os.environ.setdefault('DEBUG', 'False')
os.environ.setdefault('CORS_ORIGINS', 'http://localhost:3000')

CLINICA_A_ID = str(uuid.uuid4())
CLINICA_B_ID = str(uuid.uuid4())

ADMIN_A_ID = str(uuid.uuid4())
PROF_A_ID = str(uuid.uuid4())
RECEPCAO_A_ID = str(uuid.uuid4())
ADMIN_B_ID = str(uuid.uuid4())
PROF_B_ID = str(uuid.uuid4())

PACIENTE_A1_ID = str(uuid.uuid4())
PACIENTE_A2_ID = str(uuid.uuid4())
PACIENTE_B1_ID = str(uuid.uuid4())

PRONTUARIO_A1_ID = str(uuid.uuid4())
RELATORIO_A1_ID = str(uuid.uuid4())
AGENDAMENTO_A1_ID = str(uuid.uuid4())

USER_DB = {
    ADMIN_A_ID: {
        'id': ADMIN_A_ID, 'clinica_id': CLINICA_A_ID,
        'role': 'admin', 'nome_completo': 'Admin A', 'ativo': True,
        'email': 'admin_a@test.com',
    },
    PROF_A_ID: {
        'id': PROF_A_ID, 'clinica_id': CLINICA_A_ID,
        'role': 'fono', 'nome_completo': 'Prof A', 'ativo': True,
        'email': 'prof_a@test.com',
    },
    RECEPCAO_A_ID: {
        'id': RECEPCAO_A_ID, 'clinica_id': CLINICA_A_ID,
        'role': 'recepcao', 'nome_completo': 'Recepcao A', 'ativo': True,
        'email': 'recepcao_a@test.com',
    },
    ADMIN_B_ID: {
        'id': ADMIN_B_ID, 'clinica_id': CLINICA_B_ID,
        'role': 'admin', 'nome_completo': 'Admin B', 'ativo': True,
        'email': 'admin_b@test.com',
    },
    PROF_B_ID: {
        'id': PROF_B_ID, 'clinica_id': CLINICA_B_ID,
        'role': 'fono', 'nome_completo': 'Prof B', 'ativo': True,
        'email': 'prof_b@test.com',
    },
}


def _make_token(user_id):
    """Gera um JWT válido para testes."""
    from app.utils.jwt_utils import create_token
    user = USER_DB[user_id]
    return create_token({'id': user_id, 'email': user['email']})


def _mock_fetch_user(user_id):
    """Simula _fetch_user_from_db retornando do USER_DB."""
    return USER_DB.get(user_id)


class FakeResponse:
    """Simula resposta do Supabase."""
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class FakeQueryBuilder:
    """Builder encadeável que simula o client do Supabase."""
    def __init__(self, data=None):
        self._data = data if data is not None else []
        self._count = len(self._data) if self._data else 0

    def select(self, *a, **kw):
        if kw.get('count') == 'exact':
            self._count = len(self._data)
        return self
    def insert(self, data):         self._data = [data]; return self
    def update(self, data):         return self
    def delete(self):               return self
    def eq(self, *a):               return self
    def neq(self, *a):              return self
    def in_(self, *a):              return self
    def not_(self, *a):             return self
    def gte(self, *a):              return self
    def lte(self, *a):              return self
    def order(self, *a, **kw):      return self
    def limit(self, *a):            return self
    def single(self):               return self
    def range(self, *a):            return self
    def ilike(self, *a):            return self
    def is_(self, *a):              return self
    def or_(self, *a):              return self
    def not_in(self, *a):           return self
    def execute(self):              return FakeResponse(self._data, count=self._count)


class FakeSupabaseClient:
    """Mock do Supabase client para testes."""
    def __init__(self):
        self._table_data = {}
        self.auth = MagicMock()

    def table(self, name):
        return FakeQueryBuilder(self._table_data.get(name, []))

    def rpc(self, fn_name, params=None):
        return FakeQueryBuilder([])


@pytest.fixture
def fake_supabase():
    return FakeSupabaseClient()


@pytest.fixture
def app(fake_supabase):
    """Cria app Flask com Supabase mockado."""
    with patch('database.supabase_client.get_supabase_client', return_value=fake_supabase), \
         patch('app.utils.jwt_utils._fetch_user_from_db', side_effect=_mock_fetch_user):
        from app import create_app
        application = create_app(testing=True)
        application.config['TESTING'] = True
        yield application


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


def auth_header(user_id):
    """Retorna dict com header Authorization para o user_id dado."""
    token = _make_token(user_id)
    return {'Authorization': f'Bearer {token}'}
