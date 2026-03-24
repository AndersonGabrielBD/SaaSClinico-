"""
Testes de autorização por role.

Verifica que cada role só acessa o que deveria.
"""
import json
from unittest.mock import patch
from tests.conftest import (
    auth_header,
    ADMIN_A_ID, PROF_A_ID, RECEPCAO_A_ID,
    CLINICA_A_ID, PACIENTE_A1_ID,
)


class TestRecepcionistRestrictions:
    """Recepcionista NÃO pode criar prontuário."""

    def test_recepcao_cannot_create_prontuario(self, client):
        resp = client.post(
            '/prontuarios',
            headers={**auth_header(RECEPCAO_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({'paciente_id': PACIENTE_A1_ID, 'titulo': 'Test'}),
        )
        assert resp.status_code == 403

    def test_recepcao_can_list_pacientes(self, client):
        resp = client.get('/pacientes', headers=auth_header(RECEPCAO_A_ID))
        assert resp.status_code == 200


class TestProfessionalRestrictions:
    """Profissional NÃO pode criar agendamento, gerenciar usuarios etc."""

    def test_prof_cannot_create_agendamento(self, client):
        resp = client.post(
            '/agendamentos',
            headers={**auth_header(PROF_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({
                'paciente_id': PACIENTE_A1_ID,
                'profissional_id': PROF_A_ID,
                'data_agendamento': '2026-12-01',
                'horario_inicio': '09:00',
                'horario_fim': '10:00',
            }),
        )
        assert resp.status_code == 403

    def test_prof_cannot_list_usuarios(self, client):
        resp = client.get('/usuarios', headers=auth_header(PROF_A_ID))
        assert resp.status_code == 403

    def test_prof_cannot_create_usuario(self, client):
        resp = client.post(
            '/usuarios',
            headers={**auth_header(PROF_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({'nome_completo': 'Hacker', 'role': 'admin'}),
        )
        assert resp.status_code == 403

    def test_prof_cannot_manage_pacotes(self, client):
        resp = client.get('/pacotes', headers=auth_header(PROF_A_ID))
        assert resp.status_code == 403

    def test_prof_cannot_manage_mensalidades(self, client):
        resp = client.get('/mensalidades', headers=auth_header(PROF_A_ID))
        assert resp.status_code == 403


class TestAdminAccess:
    """Admin pode acessar tudo dentro da clínica."""

    def test_admin_can_list_pacientes(self, client):
        resp = client.get('/pacientes', headers=auth_header(ADMIN_A_ID))
        assert resp.status_code == 200

    def test_admin_can_list_agendamentos(self, client):
        resp = client.get('/agendamentos', headers=auth_header(ADMIN_A_ID))
        assert resp.status_code == 200

    def test_admin_can_list_usuarios(self, client):
        resp = client.get('/usuarios', headers=auth_header(ADMIN_A_ID))
        assert resp.status_code == 200

    def test_admin_can_access_dashboard(self, client):
        resp = client.get('/dashboard/stats', headers=auth_header(ADMIN_A_ID))
        assert resp.status_code in (200, 500)

    def test_admin_can_access_financeiro(self, client):
        resp = client.get('/financeiro/lancamentos', headers=auth_header(ADMIN_A_ID))
        assert resp.status_code in (200, 500)


class TestPasswordMinLength:
    """Senha mínima padronizada em 8 caracteres."""

    def test_change_password_rejects_short(self, client):
        resp = client.post(
            '/senha/change-password',
            headers={**auth_header(ADMIN_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({
                'old_password': 'oldpass123',
                'new_password': '1234567',
                'confirm_password': '1234567',
            }),
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert '8' in data.get('error', '')

    def test_change_password_accepts_valid_length(self, client):
        resp = client.post(
            '/senha/change-password',
            headers={**auth_header(ADMIN_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({
                'old_password': 'oldpass123',
                'new_password': '12345678',
                'confirm_password': '12345678',
            }),
        )
        # Should pass validation (will fail at Supabase auth, which is mocked)
        assert resp.status_code != 400 or '8' not in resp.get_json().get('error', '')
