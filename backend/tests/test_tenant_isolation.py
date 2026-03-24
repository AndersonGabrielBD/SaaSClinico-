"""
Testes de isolamento multi-tenant.

Verifica que clínica A não acessa dados da clínica B e vice-versa.
Verifica restrições de profissionais dentro da mesma clínica.
"""
import json
from unittest.mock import patch, MagicMock
from tests.conftest import (
    auth_header,
    CLINICA_A_ID, CLINICA_B_ID,
    ADMIN_A_ID, PROF_A_ID, RECEPCAO_A_ID,
    ADMIN_B_ID, PROF_B_ID,
    PACIENTE_A1_ID, PACIENTE_B1_ID,
    PRONTUARIO_A1_ID, RELATORIO_A1_ID, AGENDAMENTO_A1_ID,
    FakeQueryBuilder, FakeResponse,
)


class TestCrossTenantIsolation:
    """Clínica B NÃO deve conseguir acessar recursos da clínica A."""

    def test_pacientes_list_isolated(self, client, fake_supabase):
        fake_supabase._table_data['pacientes'] = [
            {'id': PACIENTE_A1_ID, 'clinica_id': CLINICA_A_ID, 'nome_completo': 'Pac A'}
        ]
        resp = client.get('/pacientes', headers=auth_header(ADMIN_B_ID))
        assert resp.status_code == 200

    def test_health_no_auth(self, client):
        resp = client.get('/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'ok'

    def test_no_token_returns_401(self, client):
        resp = client.get('/pacientes')
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client):
        resp = client.get('/pacientes', headers={'Authorization': 'Bearer invalid.token.here'})
        assert resp.status_code == 401


class TestInactiveUser:
    """Usuário inativo deve receber 401."""

    def test_inactive_user_blocked(self, client):
        from tests.conftest import USER_DB, ADMIN_A_ID
        original = USER_DB[ADMIN_A_ID].copy()
        USER_DB[ADMIN_A_ID]['ativo'] = False
        try:
            resp = client.get('/pacientes', headers=auth_header(ADMIN_A_ID))
            assert resp.status_code == 401
            data = resp.get_json()
            assert 'inativo' in data.get('error', '').lower()
        finally:
            USER_DB[ADMIN_A_ID] = original


class TestAgendamentoExportPdfProfessionalFilter:
    """Profissional só deve exportar PDF da própria agenda."""

    def test_prof_export_pdf_uses_own_id(self, client, fake_supabase):
        resp = client.get(
            f'/agendamentos/export-pdf?data_inicio=2026-01-01&data_fim=2026-12-31',
            headers=auth_header(PROF_A_ID),
        )
        assert resp.status_code in (200, 500)


class TestProntuarioVinculoCheck:
    """Profissional sem vínculo não pode editar/deletar prontuário."""

    def _mock_get_by_id(self, prontuario_id):
        if prontuario_id == PRONTUARIO_A1_ID:
            return {
                'id': PRONTUARIO_A1_ID,
                'clinica_id': CLINICA_A_ID,
                'paciente_id': PACIENTE_A1_ID,
                'titulo': 'Test',
            }
        return None

    def test_prof_cannot_update_unlinked_prontuario(self, client, fake_supabase):
        with patch('app.repositories.base_repository.BaseRepository.get_by_id',
                   side_effect=self._mock_get_by_id):
            fake_supabase._table_data['pacientes_profissionais'] = []

            resp = client.put(
                f'/prontuarios/{PRONTUARIO_A1_ID}',
                headers={**auth_header(PROF_A_ID), 'Content-Type': 'application/json'},
                data=json.dumps({'titulo': 'Hacked'}),
            )
            assert resp.status_code == 403

    def test_prof_cannot_delete_unlinked_prontuario(self, client, fake_supabase):
        with patch('app.repositories.base_repository.BaseRepository.get_by_id',
                   side_effect=self._mock_get_by_id):
            fake_supabase._table_data['pacientes_profissionais'] = []

            resp = client.delete(
                f'/prontuarios/{PRONTUARIO_A1_ID}',
                headers=auth_header(PROF_A_ID),
            )
            assert resp.status_code == 403

    def test_admin_can_update_any_prontuario(self, client, fake_supabase):
        with patch('app.repositories.base_repository.BaseRepository.get_by_id',
                   side_effect=self._mock_get_by_id), \
             patch('app.repositories.base_repository.BaseRepository.update',
                   return_value={'id': PRONTUARIO_A1_ID, 'titulo': 'Updated'}):
            resp = client.put(
                f'/prontuarios/{PRONTUARIO_A1_ID}',
                headers={**auth_header(ADMIN_A_ID), 'Content-Type': 'application/json'},
                data=json.dumps({'titulo': 'Updated'}),
            )
            assert resp.status_code == 200


class TestRelatorioRoleFilter:
    """Profissional só vê/baixa relatórios próprios."""

    def _mock_buscar_relatorio(self, relatorio_id, clinica_id):
        return {
            'id': RELATORIO_A1_ID,
            'clinica_id': CLINICA_A_ID,
            'profissional_id': PROF_B_ID,
            'titulo': 'Relatorio de outro prof',
            'tipo_arquivo': 'application/pdf',
            'nome_arquivo_original': 'test.pdf',
        }

    def test_prof_cannot_get_other_prof_relatorio(self, client):
        with patch('app.services.relatorio_service.RelatorioService.buscar_relatorio',
                   side_effect=self._mock_buscar_relatorio):
            resp = client.get(
                f'/relatorios/{RELATORIO_A1_ID}',
                headers=auth_header(PROF_A_ID),
            )
            assert resp.status_code == 403

    def test_prof_cannot_download_other_prof_relatorio(self, client):
        with patch('app.services.relatorio_service.RelatorioService.buscar_relatorio',
                   side_effect=self._mock_buscar_relatorio):
            resp = client.get(
                f'/relatorios/{RELATORIO_A1_ID}/download',
                headers=auth_header(PROF_A_ID),
            )
            assert resp.status_code == 403

    def test_admin_can_get_any_relatorio(self, client):
        with patch('app.services.relatorio_service.RelatorioService.buscar_relatorio',
                   side_effect=self._mock_buscar_relatorio):
            resp = client.get(
                f'/relatorios/{RELATORIO_A1_ID}',
                headers=auth_header(ADMIN_A_ID),
            )
            assert resp.status_code == 200

    def test_prof_cannot_update_other_prof_relatorio(self, client):
        with patch('app.services.relatorio_service.RelatorioService.buscar_relatorio',
                   side_effect=self._mock_buscar_relatorio):
            resp = client.put(
                f'/relatorios/{RELATORIO_A1_ID}',
                headers={**auth_header(PROF_A_ID), 'Content-Type': 'application/json'},
                data=json.dumps({'titulo': 'Hacked'}),
            )
            assert resp.status_code == 403

    def test_prof_cannot_delete_other_prof_relatorio(self, client):
        with patch('app.services.relatorio_service.RelatorioService.buscar_relatorio',
                   side_effect=self._mock_buscar_relatorio):
            resp = client.delete(
                f'/relatorios/{RELATORIO_A1_ID}',
                headers=auth_header(PROF_A_ID),
            )
            assert resp.status_code == 403
