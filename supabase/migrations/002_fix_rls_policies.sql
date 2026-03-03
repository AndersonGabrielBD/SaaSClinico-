-- ============================================================================
-- FonoFlow: Correção das Políticas de RLS 
-- Problema: get_clinica_id() tentava buscar do JWT mas o campo não existe
-- Solução: Buscar clinica_id da tabela usuarios baseado no auth.uid()
-- IMPORTANTE: CASCADE remove TODAS as policies - precisamos recriar TODAS!
-- ============================================================================

-- ============================================================================
-- 1. RECRIAR FUNÇÕES AUXILIARES
-- ============================================================================

-- Remove função antiga (CASCADE remove as 32+ policies que dependem dela)
DROP FUNCTION IF EXISTS get_clinica_id() CASCADE;

-- Recria get_user_id() também (pode ter sido afetada)
DROP FUNCTION IF EXISTS get_user_id() CASCADE;

-- Nova função que busca clinica_id da tabela usuarios
CREATE OR REPLACE FUNCTION get_clinica_id()
RETURNS UUID AS $$
DECLARE
    v_clinica_id UUID;
BEGIN
    -- Busca clinica_id do usuário logado na tabela usuarios
    SELECT clinica_id INTO v_clinica_id
    FROM public.usuarios
    WHERE id = auth.uid();
    
    RETURN v_clinica_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Recria função get_user_id
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. RECRIAR TODAS AS POLÍTICAS DE RLS - USUARIOS
-- ============================================================================

-- IMPORTANTE: Permite SELECT sem depender de get_clinica_id() para evitar loop circular
-- A policy permite ver o próprio usuário OU usuários da mesma clínica
CREATE POLICY "usuarios_select_same_clinica" ON public.usuarios
    FOR SELECT
    USING (
        id = auth.uid()  -- Sempre pode ver a si mesmo (essencial para get_clinica_id funcionar)
        OR 
        clinica_id = get_clinica_id()  -- Pode ver usuários da mesma clínica
    );

CREATE POLICY "usuarios_insert_own_clinica" ON public.usuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "usuarios_update_own_clinica" ON public.usuarios
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "usuarios_delete_own_clinica" ON public.usuarios
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- 3. RECRIAR TODAS AS POLÍTICAS DE RLS - PACIENTES
-- ============================================================================

CREATE POLICY "pacientes_select_same_clinica" ON public.pacientes
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "pacientes_insert_own_clinica" ON public.pacientes
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "pacientes_update_own_clinica" ON public.pacientes
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "pacientes_delete_own_clinica" ON public.pacientes
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- 4. RECRIAR TODAS AS POLÍTICAS DE RLS - SALAS
-- ============================================================================

CREATE POLICY "salas_select_same_clinica" ON public.salas
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "salas_insert_own_clinica" ON public.salas
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "salas_update_own_clinica" ON public.salas
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 5. RECRIAR TODAS AS POLÍTICAS DE RLS - AGENDAMENTOS
-- ============================================================================

CREATE POLICY "agendamentos_select_same_clinica" ON public.agendamentos
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "agendamentos_insert_own_clinica" ON public.agendamentos
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "agendamentos_update_own_clinica" ON public.agendamentos
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "agendamentos_delete_own_clinica" ON public.agendamentos
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- 6. RECRIAR TODAS AS POLÍTICAS DE RLS - PRONTUÁRIOS
-- ============================================================================

CREATE POLICY "prontuarios_select_same_clinica" ON public.prontuarios
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "prontuarios_insert_own_clinica" ON public.prontuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "prontuarios_update_own_clinica" ON public.prontuarios
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 7. RECRIAR TODAS AS POLÍTICAS DE RLS - EVOLUÇÕES
-- ============================================================================

CREATE POLICY "evolucoes_select_same_clinica" ON public.evolucoes
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "evolucoes_insert_own_clinica" ON public.evolucoes
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "evolucoes_update_own_clinica" ON public.evolucoes
    FOR UPDATE
    USING (clinica_id = get_clinica_id() AND NOT imutavel AND criado_por = get_user_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 8. RECRIAR TODAS AS POLÍTICAS DE RLS - ANEXOS DE PRONTUÁRIOS
-- ============================================================================

CREATE POLICY "anexos_select_same_clinica" ON public.anexos_prontuarios
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "anexos_insert_own_clinica" ON public.anexos_prontuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "anexos_delete_criador" ON public.anexos_prontuarios
    FOR DELETE
    USING (clinica_id = get_clinica_id() AND criado_por = get_user_id());

-- ============================================================================
-- 9. RECRIAR TODAS AS POLÍTICAS DE RLS - SERVIÇOS
-- ============================================================================

CREATE POLICY "servicos_select_same_clinica" ON public.servicos
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "servicos_insert_own_clinica" ON public.servicos
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "servicos_update_own_clinica" ON public.servicos
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 10. RECRIAR TODAS AS POLÍTICAS DE RLS - LANÇAMENTOS FINANCEIROS
-- ============================================================================

CREATE POLICY "lancamentos_select_same_clinica" ON public.lancamentos_financeiros
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "lancamentos_insert_own_clinica" ON public.lancamentos_financeiros
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

CREATE POLICY "lancamentos_update_own_clinica" ON public.lancamentos_financeiros
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 11. RECRIAR TODAS AS POLÍTICAS DE RLS - AUDIT LOGS
-- ============================================================================

CREATE POLICY "audit_logs_select_same_clinica" ON public.audit_logs
    FOR SELECT
    USING (clinica_id = get_clinica_id());

CREATE POLICY "audit_logs_insert_own_clinica" ON public.audit_logs
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- 12. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice para acelerar lookup de clinica_id por auth.uid()
CREATE INDEX IF NOT EXISTS idx_usuarios_id_clinica 
ON public.usuarios(id, clinica_id);

-- ============================================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON FUNCTION get_clinica_id() IS 
'Retorna clinica_id do usuário logado. Marcada como SECURITY DEFINER para funcionar em INSERTs.';

COMMENT ON FUNCTION get_user_id() IS 
'Retorna user_id (UUID) do usuário autenticado via auth.uid().';
