-- ============================================================================
-- Sprint 0 — Soft delete + Trilha de auditoria (LGPD / CFM)
--
-- Itens cobertos:
--   S0-7  Soft delete em `prontuarios` (campo deletado_em)
--   S0-8  Soft delete em `lancamentos_financeiros` (campo deletado_em)
--   S0-10 Função `log_event` + triggers de auditoria em
--         prontuarios, evolucoes, pacientes, lancamentos_financeiros,
--         pagamentos_mensalidades
--
-- IMPORTANTE: este script é idempotente (usa IF NOT EXISTS / CREATE OR REPLACE)
-- e foi escrito para rodar de forma segura em produção.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Soft delete: novas colunas + índices parciais
-- ----------------------------------------------------------------------------
ALTER TABLE public.prontuarios
    ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_prontuarios_deletado_em
    ON public.prontuarios(deletado_em)
    WHERE deletado_em IS NULL;

ALTER TABLE public.lancamentos_financeiros
    ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_lancamentos_deletado_em
    ON public.lancamentos_financeiros(deletado_em)
    WHERE deletado_em IS NULL;

COMMENT ON COLUMN public.prontuarios.deletado_em IS
    'Soft delete: data/hora em que o prontuário foi marcado como excluído. Registro permanece no banco por exigência LGPD/CFM.';
COMMENT ON COLUMN public.lancamentos_financeiros.deletado_em IS
    'Soft delete: data/hora em que o lançamento foi marcado como excluído. Registro permanece no banco para auditoria contábil.';

-- ----------------------------------------------------------------------------
-- 2. RPC get_prontuarios / get_prontuario_by_id passam a ignorar deletados
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_prontuarios(UUID, UUID, INT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION get_prontuarios(
    p_clinica_id UUID,
    p_paciente_id UUID DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'data_criacao',
    p_desc BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    paciente_id UUID,
    agendamento_id UUID,
    titulo VARCHAR,
    descricao TEXT,
    diagnostico_preliminar TEXT,
    historico_clinico TEXT,
    alergias TEXT,
    medicacoes TEXT,
    visivel_para_paciente BOOLEAN,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id, p.clinica_id, p.paciente_id, p.agendamento_id,
        p.titulo, p.descricao, p.diagnostico_preliminar,
        p.historico_clinico, p.alergias, p.medicacoes,
        p.visivel_para_paciente, p.data_criacao, p.data_atualizacao, p.criado_por
    FROM prontuarios p
    WHERE p.clinica_id = p_clinica_id
      AND p.deletado_em IS NULL
      AND (p_paciente_id IS NULL OR p.paciente_id = p_paciente_id)
    ORDER BY
        CASE WHEN p_order_by = 'data_criacao' AND NOT p_desc THEN p.data_criacao END ASC,
        CASE WHEN p_order_by = 'data_criacao' AND p_desc THEN p.data_criacao END DESC,
        CASE WHEN p_order_by = 'titulo' AND NOT p_desc THEN p.titulo END ASC,
        CASE WHEN p_order_by = 'titulo' AND p_desc THEN p.titulo END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_prontuario_by_id(UUID, UUID);

CREATE OR REPLACE FUNCTION get_prontuario_by_id(
    p_id UUID,
    p_clinica_id UUID
)
RETURNS SETOF prontuarios AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM prontuarios
    WHERE id = p_id
      AND clinica_id = p_clinica_id
      AND deletado_em IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_prontuarios TO authenticated;
GRANT EXECUTE ON FUNCTION get_prontuario_by_id TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Função utilitária para o backend: log_event
--    Permite registrar manualmente eventos de "VIEW" (leitura sensível)
--    que triggers não capturam.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_event(
    p_tabela TEXT,
    p_registro_id UUID,
    p_acao TEXT,
    p_usuario_id UUID,
    p_clinica_id UUID,
    p_dados_anteriores JSONB DEFAULT NULL,
    p_dados_novos JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        clinica_id, usuario_id, tabela_afetada,
        registro_id, acao, dados_anteriores, dados_novos
    )
    VALUES (
        p_clinica_id, p_usuario_id, p_tabela,
        p_registro_id, p_acao, p_dados_anteriores, p_dados_novos
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.log_event TO authenticated, service_role;

COMMENT ON FUNCTION public.log_event IS
    'Insere manualmente registro em audit_logs (usado por backend para logar leituras/exports sensíveis).';

-- ----------------------------------------------------------------------------
-- 4. Trigger genérica de auditoria para INSERT/UPDATE/DELETE
--    Estratégia: tenta extrair clinica_id e criado_por do row, com fallback
--    seguro para current_setting() (definido pelo backend antes da query).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_clinica_id UUID;
    v_usuario_id UUID;
    v_registro_id UUID;
    v_dados_old JSONB;
    v_dados_new JSONB;
BEGIN
    -- 1) clinica_id
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_clinica_id := (to_jsonb(OLD)->>'clinica_id')::UUID;
            v_registro_id := (to_jsonb(OLD)->>'id')::UUID;
            v_dados_old := to_jsonb(OLD);
            v_dados_new := NULL;
        ELSIF TG_OP = 'UPDATE' THEN
            v_clinica_id := (to_jsonb(NEW)->>'clinica_id')::UUID;
            v_registro_id := (to_jsonb(NEW)->>'id')::UUID;
            v_dados_old := to_jsonb(OLD);
            v_dados_new := to_jsonb(NEW);
        ELSE -- INSERT
            v_clinica_id := (to_jsonb(NEW)->>'clinica_id')::UUID;
            v_registro_id := (to_jsonb(NEW)->>'id')::UUID;
            v_dados_old := NULL;
            v_dados_new := to_jsonb(NEW);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_clinica_id := NULL;
    END;

    -- 2) usuario_id (do GUC setado pelo backend, ou auth.uid())
    BEGIN
        v_usuario_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_usuario_id := NULL;
    END;

    IF v_usuario_id IS NULL THEN
        BEGIN
            v_usuario_id := auth.uid();
        EXCEPTION WHEN OTHERS THEN
            v_usuario_id := NULL;
        END;
    END IF;

    -- 3) Insere o log (não falha a operação principal se o insert do log der erro)
    BEGIN
        INSERT INTO public.audit_logs (
            clinica_id, usuario_id, tabela_afetada,
            registro_id, acao, dados_anteriores, dados_novos
        )
        VALUES (
            v_clinica_id, v_usuario_id, TG_TABLE_NAME,
            v_registro_id, TG_OP, v_dados_old, v_dados_new
        );
    EXCEPTION WHEN OTHERS THEN
        -- Auditoria nunca deve impedir a operação clínica.
        -- Logamos uma NOTICE para o psql/postgrest.
        RAISE NOTICE '[audit] falha ao inserir audit_logs para %.%: %', TG_TABLE_NAME, v_registro_id, SQLERRM;
    END;

    -- Retorno apropriado para o tipo de operação
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.audit_trigger_fn IS
    'Trigger genérica de auditoria — popula audit_logs com dados antes/depois e nunca aborta a operação principal.';

-- ----------------------------------------------------------------------------
-- 5. Triggers em cada tabela sensível
--    Drop + recreate para garantir idempotência.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_prontuarios ON public.prontuarios;
CREATE TRIGGER trg_audit_prontuarios
    AFTER INSERT OR UPDATE OR DELETE ON public.prontuarios
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_evolucoes ON public.evolucoes;
CREATE TRIGGER trg_audit_evolucoes
    AFTER INSERT OR UPDATE OR DELETE ON public.evolucoes
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_pacientes ON public.pacientes;
CREATE TRIGGER trg_audit_pacientes
    AFTER INSERT OR UPDATE OR DELETE ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_lancamentos ON public.lancamentos_financeiros;
CREATE TRIGGER trg_audit_lancamentos
    AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_financeiros
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- Trigger em pagamentos_mensalidades (se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pagamentos_mensalidades'
    ) THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_pagamentos ON public.pagamentos_mensalidades';
        EXECUTE 'CREATE TRIGGER trg_audit_pagamentos
                 AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_mensalidades
                 FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. RLS extra para audit_logs: permitir apenas admin/super_admin ler
-- ----------------------------------------------------------------------------
-- A policy de SELECT por clínica já existe (audit_logs_select_same_clinica).
-- Não vamos restringir a leitura via SQL aqui — o backend filtra por role.

-- ----------------------------------------------------------------------------
-- FIM
-- ----------------------------------------------------------------------------
