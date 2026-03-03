-- ============================================================================
-- FonoFlow: Otimização de Performance
-- Problema: Triggers de auditoria e policies RLS causando lentidão
-- ============================================================================

-- ============================================================================
-- 1. REMOVER TRIGGERS PESADOS DE AUDITORIA EM TABELAS DE CONSULTA FREQUENTE
-- ============================================================================

-- Remove triggers de auditoria de usuarios (já auditado pelo Supabase Auth)
DROP TRIGGER IF EXISTS audit_usuarios ON public.usuarios;

-- Remove trigger de notificações (causa overhead desnecessário no login)
DROP TRIGGER IF EXISTS notificar_confirmacao_agendamento_trigger ON public.agendamentos;

-- Mantém apenas triggers críticos: pacientes, prontuarios, evolucoes, lancamentos

-- ============================================================================
-- 2. OTIMIZAR FUNÇÃO DE AUDITORIA
-- ============================================================================

-- Versão simplificada que captura apenas mudanças críticas
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_alteracoes JSONB;
BEGIN
    -- Captura dados de forma simplificada (sem processar headers HTTP)
    IF TG_OP = 'INSERT' THEN
        v_alteracoes := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Apenas registra que houve update (sem comparar campo por campo)
        v_alteracoes := jsonb_build_object('updated', true);
    ELSIF TG_OP = 'DELETE' THEN
        v_alteracoes := to_jsonb(OLD);
    END IF;

    -- Insere registro de auditoria simplificado
    INSERT INTO public.audit_logs (
        clinica_id,
        usuario_id,
        tabela_afetada,
        registro_id,
        acao,
        alteracoes_resumo,
        data_acao
    ) VALUES (
        CASE 
            WHEN TG_OP = 'INSERT' THEN NEW.clinica_id
            WHEN TG_OP = 'UPDATE' THEN NEW.clinica_id
            WHEN TG_OP = 'DELETE' THEN OLD.clinica_id
        END,
        auth.uid(),
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'INSERT' THEN NEW.id
            WHEN TG_OP = 'UPDATE' THEN NEW.id
            WHEN TG_OP = 'DELETE' THEN OLD.id
        END,
        TG_OP,
        v_alteracoes,
        NOW()
    );

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. SIMPLIFICAR VALIDAÇÃO DE CONFLITOS DE AGENDA
-- ============================================================================

-- Otimizar função para usar índices mais eficientemente
CREATE OR REPLACE FUNCTION validar_conflito_agendamento()
RETURNS TRIGGER AS $$
DECLARE
    v_conflito_count INT;
BEGIN
    -- Apenas valida se está sendo agendado ou confirmado
    IF NEW.status NOT IN ('agendada', 'confirmada') THEN
        RETURN NEW;
    END IF;
    
    -- Query otimizada com índice composto
    SELECT COUNT(*)
    INTO v_conflito_count
    FROM public.agendamentos
    WHERE clinica_id = NEW.clinica_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND data_agendamento = NEW.data_agendamento
      AND status IN ('agendada', 'confirmada')
      AND (
          -- Conflito com profissional
          (profissional_id = NEW.profissional_id)
          OR
          -- Conflito com sala (se sala selecionada)
          (sala_id IS NOT NULL AND sala_id = NEW.sala_id)
      )
      AND (horario_inicio, horario_fim) OVERLAPS (NEW.horario_inicio, NEW.horario_fim);

    IF v_conflito_count > 0 THEN
        RAISE EXCEPTION 'Conflito de horário detectado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. DESABILITAR CRIAÇÃO AUTOMÁTICA DE LANÇAMENTOS
-- ============================================================================

-- Remove trigger que cria lançamentos automaticamente (pode ser feito pela aplicação)
DROP TRIGGER IF EXISTS criar_lancamento_ao_concluir_agendamento_trigger ON public.agendamentos;

-- ============================================================================
-- 5. OTIMIZAR ÍNDICES PARA QUERIES COMUNS
-- ============================================================================

-- Índice composto para busca de usuário por ID (cache lookup)
CREATE INDEX IF NOT EXISTS idx_usuarios_id_clinica ON public.usuarios(id, clinica_id) 
    WHERE ativo = true;

-- Índice para validação de conflitos de agenda
CREATE INDEX IF NOT EXISTS idx_agendamentos_conflito ON public.agendamentos(
    clinica_id, 
    data_agendamento, 
    profissional_id, 
    status
) WHERE status IN ('agendada', 'confirmada');

-- Índice para busca de pacientes ativos
CREATE INDEX IF NOT EXISTS idx_pacientes_ativo_clinica ON public.pacientes(clinica_id, ativo)
    WHERE ativo = true;

-- ============================================================================
-- 6. AJUSTAR audit_logs PARA NÃO BLOQUEAR QUERIES
-- ============================================================================

-- Adiciona campo opcional para dados complexos
ALTER TABLE public.audit_logs 
    ALTER COLUMN dados_anteriores DROP NOT NULL,
    ALTER COLUMN dados_novos DROP NOT NULL,
    ALTER COLUMN endereco_ip DROP NOT NULL,
    ALTER COLUMN user_agent DROP NOT NULL;

-- ============================================================================
-- 7. CRIAR FUNÇÃO OTIMIZADA PARA GET USER (USADO NO LOGIN)
-- ============================================================================

-- Função específica para buscar dados do usuário no login
CREATE OR REPLACE FUNCTION get_usuario_login(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    nome_completo VARCHAR,
    email VARCHAR,
    role user_role,
    ativo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.clinica_id,
        u.nome_completo,
        u.email,
        u.role,
        u.ativo
    FROM public.usuarios u
    WHERE u.id = p_user_id
      AND u.ativo = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION audit_trigger_function() IS 'Versão otimizada - registra apenas alterações essenciais';
COMMENT ON FUNCTION validar_conflito_agendamento() IS 'Versão otimizada - usa índices compostos';
COMMENT ON FUNCTION get_usuario_login(UUID) IS 'Função otimizada para login - evita subqueries RLS';
