-- ============================================================================
-- Fase 1 — Sprint 1 (PLANO_EVOLUCAO.md)
-- 1.2 EXCLUDE GIST em agendamentos (sobreposição mesmo profissional)
-- 1.3/1.4 Colunas deletado_em em evolucoes e relatorios + índices
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- 1.2 Impedir overlap de horário por profissional (status ativos)
-- Exclui agendamentos cancelados/concluídos do índice de exclusão.
-- Código de erro Postgres: 23P01 (exclusion_violation)
-- ----------------------------------------------------------------------------
ALTER TABLE public.agendamentos
    DROP CONSTRAINT IF EXISTS agendamentos_profissional_horario_excl;

ALTER TABLE public.agendamentos
    ADD CONSTRAINT agendamentos_profissional_horario_excl
    EXCLUDE USING gist (
        profissional_id WITH =,
        tsrange(
            (data_agendamento + horario_inicio)::timestamp,
            (data_agendamento + horario_fim)::timestamp,
            '[)'
        ) WITH &&
    )
    WHERE (
        -- Predicado só com comparações imutáveis (status::text é STABLE e quebra 42P17).
        status IS DISTINCT FROM 'cancelada'::public.appointment_status
        AND status IS DISTINCT FROM 'concluida'::public.appointment_status
    );

COMMENT ON CONSTRAINT agendamentos_profissional_horario_excl ON public.agendamentos IS
    'Impede dois agendamentos sobrepostos para o mesmo profissional (defesa em profundidade; app também valida).';

-- Se `status` for text/varchar (sem enum appointment_status), troque o WHERE por:
--   WHERE (status <> 'cancelada' AND status <> 'concluida')
-- (também imutável; não use status::text no predicado.)

-- ----------------------------------------------------------------------------
-- 1.3 Soft delete em evolucoes
-- ----------------------------------------------------------------------------
ALTER TABLE public.evolucoes
    ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_evolucoes_deletado_em
    ON public.evolucoes (clinica_id, prontuario_id)
    WHERE deletado_em IS NULL;

COMMENT ON COLUMN public.evolucoes.deletado_em IS
    'Soft delete da evolução; retenção CFM — hard delete apenas por política/legal, não pelo job de 90 dias.';

-- ----------------------------------------------------------------------------
-- 1.4 Soft delete em relatorios (papel-lixo 90 dias no app/job)
-- ----------------------------------------------------------------------------
ALTER TABLE public.relatorios
    ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_relatorios_nao_deletados
    ON public.relatorios (clinica_id)
    WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_relatorios_deletado_em_cleanup
    ON public.relatorios (deletado_em)
    WHERE deletado_em IS NOT NULL;

COMMENT ON COLUMN public.relatorios.deletado_em IS
    'Soft delete; após 90 dias o job mensal pode remover o registro e o arquivo no storage.';
